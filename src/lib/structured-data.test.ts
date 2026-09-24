import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { hasBlockingIssues, validatePage } from "./structured-data";

/**
 * The real, pinned vocabulary (`scripts/vendor/`), not a hand-written
 * subset. `@adobe/structured-data-validator`'s schema.org handler caches the
 * first vocabulary it's given in a process-wide `static` field (see the note
 * on `validatePage`), so every test in this file shares this one instance
 * regardless — loading the real ~230 KB file costs that once per run, and in
 * return tests stay honest about what schema.org actually accepts, with
 * nothing to keep in sync with the vendored copy by hand.
 */
const VOCABULARY = JSON.parse(
	gunzipSync(
		readFileSync(
			join(process.cwd(), "scripts/vendor/schemaorg-30.1.jsonld.gz"),
		),
	).toString("utf8"),
);

/** Wraps one JSON-LD graph in an otherwise-empty page, as `dist/**\/*.html` pages would have it. */
const page = (graph: object) =>
	`<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(
		graph,
	)}</script></head><body></body></html>`;

/** Shaped like `articleGraph`'s output in `seo.ts`: a BlogPosting and its BreadcrumbList. */
const completeArticle = () => ({
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "BlogPosting",
			headline: "A great post",
			description: "A great post about testing.",
			url: "https://example.com/writing/a-great-post/",
			datePublished: "2024-01-01T00:00:00.000Z",
			dateModified: "2024-01-01T00:00:00.000Z",
			author: {
				"@type": "Person",
				name: "Jane Doe",
				url: "https://example.com/",
			},
			image: "https://example.com/og/default.png",
		},
		{
			"@type": "BreadcrumbList",
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Home",
					item: "https://example.com/",
				},
				{
					"@type": "ListItem",
					position: 2,
					name: "Writing",
					item: "https://example.com/writing/",
				},
				{
					"@type": "ListItem",
					position: 3,
					name: "A great post",
					item: "https://example.com/writing/a-great-post/",
				},
			],
		},
	],
});

describe("validatePage", () => {
	it("passes a complete, valid article page", async () => {
		const issues = await validatePage(
			page(completeArticle()),
			"/writing/a-great-post/",
			VOCABULARY,
		);
		expect(issues).toEqual([]);
	});

	it("flags an invalid @type as an ERROR", async () => {
		// checkSiteRules has no BlogPosting-specific handler enforcing required
		// fields by itself (that's this site's own rules, tested in
		// structured-data-rules.test.ts). A misspelled @type is the reliable
		// way to force an ERROR out of the vendor validator itself: schema.org's
		// generic handler rejects unknown types outright.
		const graph = completeArticle();
		(graph["@graph"][0] as { "@type": string })["@type"] = "BlogPost";
		const issues = await validatePage(
			page(graph),
			"/writing/broken-post/",
			VOCABULARY,
		);
		expect(issues).toContainEqual(
			expect.objectContaining({
				severity: "ERROR",
				issueMessage: 'Type "BlogPost" is not a valid schema.org type',
			}),
		);
	});

	it("flags an unrecognized property as a WARNING", async () => {
		const graph = completeArticle();
		(graph["@graph"][0] as Record<string, unknown>).notARealProperty = "x";
		const issues = await validatePage(
			page(graph),
			"/writing/a-great-post/",
			VOCABULARY,
		);
		expect(issues).toContainEqual(
			expect.objectContaining({
				severity: "WARNING",
				issueMessage:
					'Property "notARealProperty" for type "BlogPosting" is not supported by the schema.org specification',
			}),
		);
	});

	it("flags a relative breadcrumb item, via the vendor validator", async () => {
		// checkSiteRules doesn't check this itself: Adobe's own
		// BreadcrumbListValidator already does (validateItemUrl), so checking
		// it again here would just double-report the same issue.
		const graph = completeArticle();
		const breadcrumbs = graph["@graph"][1] as {
			itemListElement: Record<string, unknown>[];
		};
		const first = breadcrumbs.itemListElement[0];
		if (!first) throw new Error("fixture has no first breadcrumb item");
		first.item = "/";
		const issues = await validatePage(
			page(graph),
			"/writing/a-great-post/",
			VOCABULARY,
		);
		expect(issues).toContainEqual(
			expect.objectContaining({
				rootType: "BreadcrumbList",
				issueMessage: expect.stringContaining("Invalid URL"),
			}),
		);
	});

	it("also runs this site's own rules, e.g. a missing BreadcrumbList", async () => {
		const graph = completeArticle();
		graph["@graph"] = graph["@graph"].filter(
			(node) => node["@type"] !== "BreadcrumbList",
		);
		const issues = await validatePage(
			page(graph),
			"/writing/a-great-post/",
			VOCABULARY,
		);
		expect(issues).toContainEqual(
			expect.objectContaining({
				rootType: "BreadcrumbList",
				issueMessage: "Missing BreadcrumbList in structured data",
			}),
		);
	});

	it("reports the page path on every issue", async () => {
		const graph = completeArticle();
		(graph["@graph"][0] as { "@type": string })["@type"] = "BlogPost";
		const issues = await validatePage(
			page(graph),
			"/writing/broken-post/",
			VOCABULARY,
		);
		expect(issues.length).toBeGreaterThan(0);
		expect(
			issues.every((issue) => issue.page === "/writing/broken-post/"),
		).toBe(true);
	});
});

describe("hasBlockingIssues", () => {
	it("is false with no issues", () => {
		expect(hasBlockingIssues([])).toBe(false);
	});

	it("is true for an ERROR", () => {
		expect(
			hasBlockingIssues([
				{
					page: "/",
					dataFormat: "jsonld",
					rootType: "WebSite",
					severity: "ERROR",
					issueMessage: "x",
				},
			]),
		).toBe(true);
	});

	it("is true for a WARNING alone — the gate has no free pass for warnings", async () => {
		const graph = completeArticle();
		(graph["@graph"][0] as Record<string, unknown>).notARealProperty = "x";
		const issues = await validatePage(
			page(graph),
			"/writing/a-great-post/",
			VOCABULARY,
		);
		expect(issues.every((issue) => issue.severity === "WARNING")).toBe(true);
		expect(hasBlockingIssues(issues)).toBe(true);
	});
});
