import { describe, expect, it } from "vitest";
import { checkPageForScripts } from "./no-js";

const page = (body: string) =>
	`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title></head><body>${body}</body></html>`;

describe("checkPageForScripts", () => {
	it("fails an inline script", () => {
		const issues = checkPageForScripts(
			page("<script>console.log(1)</script>"),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining("inline <script>"),
			}),
		]);
	});

	it("fails an external app script", () => {
		const issues = checkPageForScripts(
			page('<script src="/_astro/app.abc123.js"></script>'),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining('src="/_astro/app.abc123.js"'),
			}),
		]);
	});

	it("passes JSON-LD", () => {
		const issues = checkPageForScripts(
			page(
				'<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
			),
			"/fixture/",
		);
		expect(issues).toEqual([]);
	});

	it("passes the Cloudflare Web Analytics beacon", () => {
		const issues = checkPageForScripts(
			page(
				`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"x"}'></script>`,
			),
			"/fixture/",
		);
		expect(issues).toEqual([]);
	});

	it("fails a script masquerading as the beacon at a different URL", () => {
		const issues = checkPageForScripts(
			page('<script src="https://evil.example/beacon.min.js"></script>'),
			"/fixture/",
		);
		expect(issues).toHaveLength(1);
	});

	it("fails an inline event handler", () => {
		const issues = checkPageForScripts(
			page('<button onclick="doThing()">Go</button>'),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining('onclick="…"'),
			}),
		]);
	});

	it("passes a clean page", () => {
		const issues = checkPageForScripts(
			page("<h1>Fixture</h1><p>Nothing to see here.</p>"),
			"/fixture/",
		);
		expect(issues).toEqual([]);
	});

	it("reports the page path on every issue", () => {
		const issues = checkPageForScripts(
			page("<script>1</script>"),
			"/writing/first-post/",
		);
		expect(issues).toEqual([
			expect.objectContaining({ page: "/writing/first-post/" }),
		]);
	});
});
