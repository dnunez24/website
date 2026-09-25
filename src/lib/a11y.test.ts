import { createServer, type Server } from "node:http";
import {
	type Browser,
	type BrowserContext,
	chromium,
	type Page,
} from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkPageAccessibility } from "./a11y";

const ACCESSIBLE_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body>
<h1>Fixture</h1>
<p style="color:#111111;background:#ffffff;">Plenty of contrast, and nothing else to trip a rule.</p>
</body>
</html>`;

// An <img> with no alt text: fails "image-alt", a WCAG 2.1 A rule.
const IMAGE_WITHOUT_ALT = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body>
<h1>Fixture</h1>
<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7">
</body>
</html>`;

// Deletes <main> and throws before axe would ever get to run — the
// scenario the review reproduced as a silent pass.
const SCRIPT_ERROR_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body>
<main><h1>Fixture</h1></main>
<script>document.querySelector("main")?.remove(); throw new Error("boom");</script>
</body>
</html>`;

const MISSING_STYLESHEET_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title><link rel="stylesheet" href="/does-not-exist.css"></head>
<body><h1>Fixture</h1></body>
</html>`;

// Unlike a missing stylesheet (which Chromium aborts as a failed request,
// since our fixture server's 404 page isn't CSS), a missing image gets a
// normal response back — just a 404 one — so this exercises the "any
// subresource response >= 400" check specifically, not requestfailed.
const MISSING_IMAGE_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body><h1>Fixture</h1><img src="/does-not-exist.png" alt="Fixture"></body>
</html>`;

// Two adjacent 10x10px buttons, crowded together with a negative margin:
// WCAG 2.2's target-size minimum is 24x24 CSS px, undersized targets are
// exempt if a 24px circle around them wouldn't reach another target, and a
// lone small button here has enough empty space to clear that exemption —
// it takes two crowded ones to force a real violation.
const TARGET_SIZE_VIOLATION_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body>
<h1>Fixture</h1>
<button type="button" aria-label="a" style="width:10px;height:10px;padding:0;border:0;">+</button><button type="button" aria-label="b" style="width:10px;height:10px;padding:0;border:0;margin-left:-5px;">-</button>
</body>
</html>`;

// Two adjacent 12x12px buttons, crowded together like the target-size
// violation fixture, but with tabindex="-1": axe can't be sure a target
// that's been pulled out of tab order is still a real interactive target,
// so it lands in "incomplete" rather than a clear violation or pass.
const TARGET_SIZE_INCOMPLETE_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body>
<h1>Fixture</h1>
<button type="button" tabindex="-1" aria-label="a" style="width:12px;height:12px;padding:0;border:0;">+</button><button type="button" tabindex="-1" aria-label="b" style="width:12px;height:12px;padding:0;border:0;margin-left:-6px;">-</button>
</body>
</html>`;

// Light gray on white: well under the 4.5:1 ratio WCAG AA requires.
const COLOR_CONTRAST_VIOLATION_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body>
<h1>Fixture</h1>
<p style="color:#dddddd;background:#ffffff;">Low contrast text that fails WCAG AA.</p>
</body>
</html>`;

// An unlabelled image that's only rendered under a narrow-viewport media
// query: image-alt should fire at 320px but not at 1024px.
const RESPONSIVE_VIOLATION_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title>
<style>
.mobile-only { display: none; }
@media (max-width: 400px) { .mobile-only { display: block; } }
</style>
</head>
<body>
<h1>Fixture</h1>
<img class="mobile-only" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7">
</body>
</html>`;

const FIXTURES: Record<string, { status?: number; body: string }> = {
	"/ok/": { body: ACCESSIBLE_PAGE },
	"/image-alt/": { body: IMAGE_WITHOUT_ALT },
	"/not-found/": {
		status: 404,
		body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found</title></head><body><h1>Not found</h1></body></html>`,
	},
	"/script-error/": { body: SCRIPT_ERROR_PAGE },
	"/missing-stylesheet/": { body: MISSING_STYLESHEET_PAGE },
	"/missing-image/": { body: MISSING_IMAGE_PAGE },
	"/target-size/": { body: TARGET_SIZE_VIOLATION_PAGE },
	"/target-size-incomplete/": { body: TARGET_SIZE_INCOMPLETE_PAGE },
	"/color-contrast/": { body: COLOR_CONTRAST_VIOLATION_PAGE },
	"/responsive/": { body: RESPONSIVE_VIOLATION_PAGE },
};

let fixtureServer: Server;
let baseUrl: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;

// Chromium's cold start takes a few seconds, same as the Mermaid tests.
describe("checkPageAccessibility", { timeout: 60_000 }, () => {
	beforeAll(async () => {
		fixtureServer = createServer((req, res) => {
			const route = FIXTURES[req.url ?? "/"];
			if (!route) {
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("Not found");
				return;
			}
			res.writeHead(route.status ?? 200, {
				"Content-Type": "text/html; charset=utf-8",
			});
			res.end(route.body);
		});
		await new Promise<void>((resolve) => {
			fixtureServer.listen(0, "127.0.0.1", resolve);
		});
		const address = fixtureServer.address();
		if (address === null || typeof address === "string") {
			throw new Error("Fixture server has no port");
		}
		baseUrl = `http://127.0.0.1:${address.port}`;

		browser = await chromium.launch({ timeout: 60_000 });
		// An explicit context, not the browser.newPage() shorthand: axe-core's
		// own "finish" step opens a second page in the same context, which
		// Playwright refuses on the shorthand's implicit single-page context.
		context = await browser.newContext();
		page = await context.newPage();
		// Vitest hooks have their own 10s default timeout, not the describe
		// block's 60s: without this, a slow Chromium cold start fails with
		// "Hook timed out in 10000ms" even though the tests themselves would
		// have had time to spare.
	}, 60_000);

	afterAll(async () => {
		await browser.close();
		await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
	});

	it("passes a clean page", async () => {
		const result = await checkPageAccessibility({
			page,
			url: `${baseUrl}/ok/`,
			width: 1024,
			height: 800,
		});
		expect(result.violations).toEqual([]);
	});

	it("flags an image with no alt text", async () => {
		const result = await checkPageAccessibility({
			page,
			url: `${baseUrl}/image-alt/`,
			width: 1024,
			height: 800,
		});
		expect(result.violations).toContainEqual(
			expect.objectContaining({ id: "image-alt" }),
		);
	});

	it("reports the page label and width on the result", async () => {
		const result = await checkPageAccessibility({
			page,
			url: `${baseUrl}/ok/`,
			label: "/fixture/",
			width: 320,
			height: 800,
		});
		expect(result.url).toBe("/fixture/");
		expect(result.width).toBe(320);
	});

	describe("a page that loads badly is a failure, not a clean pass", () => {
		it("throws on a non-OK response", async () => {
			await expect(
				checkPageAccessibility({
					page,
					url: `${baseUrl}/not-found/`,
					width: 1024,
					height: 800,
				}),
			).rejects.toThrow(/responded 404/);
		});

		it("accepts a deliberate, explicitly expected status", async () => {
			const result = await checkPageAccessibility({
				page,
				url: `${baseUrl}/not-found/`,
				width: 1024,
				height: 800,
				expectedStatus: 404,
			});
			expect(result.violations).toEqual([]);
		});

		it("throws on an uncaught page script error", async () => {
			await expect(
				checkPageAccessibility({
					page,
					url: `${baseUrl}/script-error/`,
					width: 1024,
					height: 800,
				}),
			).rejects.toThrow(/script error/);
		});

		it("throws on a missing subresource, like a stylesheet", async () => {
			// Chromium aborts a stylesheet request whose response isn't CSS
			// (our fixture server's 404 page is text/plain), so this goes
			// through the failed-request check rather than the subresource
			// status check — both exist so either kind of failure is caught.
			await expect(
				checkPageAccessibility({
					page,
					url: `${baseUrl}/missing-stylesheet/`,
					width: 1024,
					height: 800,
				}),
			).rejects.toThrow(/failed request/);
		});

		it("throws on a missing image (a genuine >= 400 subresource response)", async () => {
			await expect(
				checkPageAccessibility({
					page,
					url: `${baseUrl}/missing-image/`,
					width: 1024,
					height: 800,
				}),
			).rejects.toThrow(/loaded a subresource/);
		});
	});

	// These pin the configuration itself: narrowing the tags or skipping
	// setViewportSize would leave the earlier tests passing, but would fail
	// these, since they need WCAG 2.2 and the right viewport to fire at all.
	describe("real violations through the same configuration the CLI uses", () => {
		it("flags a target-size violation (WCAG 2.2, disabled by default in axe)", async () => {
			const result = await checkPageAccessibility({
				page,
				url: `${baseUrl}/target-size/`,
				width: 1024,
				height: 800,
			});
			expect(result.violations).toContainEqual(
				expect.objectContaining({ id: "target-size" }),
			);
		});

		it("lists an ambiguous target (tabindex=-1) as incomplete, not a violation", async () => {
			const result = await checkPageAccessibility({
				page,
				url: `${baseUrl}/target-size-incomplete/`,
				width: 1024,
				height: 800,
			});
			expect(result.violations).toEqual([]);
			expect(result.incomplete).toContainEqual(
				expect.objectContaining({ id: "target-size" }),
			);
		});

		it("flags a color-contrast violation", async () => {
			const result = await checkPageAccessibility({
				page,
				url: `${baseUrl}/color-contrast/`,
				width: 1024,
				height: 800,
			});
			expect(result.violations).toContainEqual(
				expect.objectContaining({ id: "color-contrast" }),
			);
		});

		it("flags a violation that only appears at 320px", async () => {
			const desktop = await checkPageAccessibility({
				page,
				url: `${baseUrl}/responsive/`,
				width: 1024,
				height: 800,
			});
			expect(
				desktop.violations.some((violation) => violation.id === "image-alt"),
			).toBe(false);

			const mobile = await checkPageAccessibility({
				page,
				url: `${baseUrl}/responsive/`,
				width: 320,
				height: 800,
			});
			expect(mobile.violations).toContainEqual(
				expect.objectContaining({ id: "image-alt" }),
			);
		});
	});
});
