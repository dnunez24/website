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

let browser: Browser;
let context: BrowserContext;
let page: Page;

// Chromium's cold start takes a few seconds, same as the Mermaid tests.
describe("checkPageAccessibility", { timeout: 60_000 }, () => {
	beforeAll(async () => {
		browser = await chromium.launch();
		// An explicit context, not the browser.newPage() shorthand: axe-core's
		// own "finish" step opens a second page in the same context, which
		// Playwright refuses on the shorthand's implicit single-page context.
		context = await browser.newContext();
		page = await context.newPage();
	});

	afterAll(async () => {
		await browser.close();
	});

	it("passes a clean page", async () => {
		await page.setContent(ACCESSIBLE_PAGE);
		const result = await checkPageAccessibility(page, "/fixture/", 1024, 800);
		expect(result.violations).toEqual([]);
	});

	it("flags an image with no alt text", async () => {
		await page.setContent(IMAGE_WITHOUT_ALT);
		const result = await checkPageAccessibility(page, "/fixture/", 1024, 800);
		expect(result.violations).toContainEqual(
			expect.objectContaining({ id: "image-alt" }),
		);
	});

	it("reports the page label and width on the result", async () => {
		await page.setContent(ACCESSIBLE_PAGE);
		const result = await checkPageAccessibility(page, "/fixture/", 320, 800);
		expect(result.url).toBe("/fixture/");
		expect(result.width).toBe(320);
	});
});
