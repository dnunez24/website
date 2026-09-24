import { describe, expect, it } from "vitest";
import { renderMermaidFigure } from "./mermaid";
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

	it("fails a script inside an SVG", () => {
		const issues = checkPageForScripts(
			page("<svg><script>alert(1)</script></svg>"),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining("inline <script>"),
			}),
		]);
	});

	it.each(["href", "src", "action", "formaction"])(
		"fails a javascript: URL in %s",
		(attribute) => {
			const issues = checkPageForScripts(
				page(`<a ${attribute}="javascript:alert(1)">Go</a>`),
				"/fixture/",
			);
			expect(issues).toEqual([
				expect.objectContaining({
					message: expect.stringContaining(`${attribute}="javascript:…"`),
				}),
			]);
		},
	);

	it("fails a javascript: URL in SVG's xlink:href", () => {
		const issues = checkPageForScripts(
			page(
				'<svg><a xlink:href="javascript:alert(1)"><circle r="1"/></a></svg>',
			),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining('xlink:href="javascript:…"'),
			}),
		]);
	});

	it("passes a normal, non-javascript: href", () => {
		const issues = checkPageForScripts(
			page('<a href="/about/">About</a>'),
			"/fixture/",
		);
		expect(issues).toEqual([]);
	});

	it("fails a javascript: URL with a tab inside the scheme", () => {
		// Browsers strip tabs and newlines before parsing the scheme, so
		// "java\tscript:" still runs as javascript: — a naive
		// startsWith("javascript:") check would miss it.
		const issues = checkPageForScripts(
			page('<a href="java&#9;script:alert(1)">Go</a>'),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining('href="javascript:…"'),
			}),
		]);
	});

	it("fails a javascript: URL with a newline inside the scheme", () => {
		const issues = checkPageForScripts(
			page('<a href="java&#10;script:alert(1)">Go</a>'),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining('href="javascript:…"'),
			}),
		]);
	});

	it("fails a javascript: URL with a leading control character", () => {
		// &#1; decodes (by the time parse5 hands us the attribute value) to a
		// real U+0001 control character, which the URL spec also strips.
		const issues = checkPageForScripts(
			page('<a href="&#1;javascript:alert(1)">Go</a>'),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({
				message: expect.stringContaining('href="javascript:…"'),
			}),
		]);
	});

	it.each([
		["a mailto: link", '<a href="mailto:dave@example.com">Email</a>'],
		["a tel: link", '<a href="tel:+15555550100">Call</a>'],
		["a same-page fragment", '<a href="#main">Skip to content</a>'],
		["a full https URL", '<a href="https://example.com/">External</a>'],
		["an href-less anchor", "<a>Not a link</a>"],
		["a form with a relative action", '<form action="/search/"></form>'],
	])("doesn't false-positive on %s", (_label, markup) => {
		expect(checkPageForScripts(page(markup), "/fixture/")).toEqual([]);
	});

	it("fails an iframe with srcdoc", () => {
		const issues = checkPageForScripts(
			page('<iframe srcdoc="<p>hi</p>"></iframe>'),
			"/fixture/",
		);
		expect(issues).toEqual([
			expect.objectContaining({ message: expect.stringContaining("srcdoc") }),
		]);
	});
});

// Chromium's cold start takes a few seconds, same as the Mermaid tests.
describe("checkPageForScripts: a real Mermaid figure", {
	timeout: 60_000,
}, () => {
	const flowchart = `flowchart LR
  accTitle: Checkout flow
  accDescr: The product page hands off to checkout.
  A[Product page] --> B[Checkout MFE]`;

	it("passes on its own — its <style> doesn't hide what follows it", async () => {
		const figure = await renderMermaidFigure(flowchart);
		const issues = checkPageForScripts(page(figure), "/fixture/");
		expect(issues).toEqual([]);
	});

	it("still catches a script and an onclick placed after it", async () => {
		// Regression case: happy-dom 20.14.5 silently drops everything from an
		// SVG <style> (which every rendered Mermaid figure has) to the end of
		// the document, so a script placed after a diagram was invisible to
		// the old implementation.
		const figure = await renderMermaidFigure(flowchart);
		const html = page(
			`${figure}<script>alert(1)</script><button onclick="x()">Go</button>`,
		);
		const issues = checkPageForScripts(html, "/fixture/");
		const messages = issues.map((issue) => issue.message);
		expect(
			messages.some((message) => message.includes("inline <script>")),
		).toBe(true);
		expect(messages.some((message) => message.includes('onclick="…"'))).toBe(
			true,
		);
	});
});
