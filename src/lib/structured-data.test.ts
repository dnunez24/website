import { describe, expect, it } from "vitest";
import { validatePage } from "./structured-data";

/**
 * A minimal slice of the schema.org vocabulary graph, shaped like
 * `schemaorg-all-https.jsonld` (the `@graph` of `rdfs:Class`/`rdf:Property`
 * nodes `Validator`'s schema.org handler reads). Real validation runs
 * against the pinned vocabulary vendored in `scripts/vendor/`; this fixture
 * just keeps the tests fast and offline.
 *
 * Every test in this file must reuse this single instance.
 * `@adobe/structured-data-validator`'s schema.org handler caches the first
 * vocabulary it's given in a process-wide `static` field (see the note on
 * `validatePage` in `structured-data.ts`), so a second, differently-shaped
 * vocabulary fixture would silently validate against this one instead of
 * its own.
 */
const VOCABULARY = {
	"@graph": [
		{ "@id": "schema:Thing", "@type": "rdfs:Class" },
		{
			"@id": "schema:CreativeWork",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:BlogPosting",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:CreativeWork" },
		},
		{
			"@id": "schema:Person",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:BreadcrumbList",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:ListItem",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:name",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:description",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:url",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:image",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:Thing" },
		},
		{
			"@id": "schema:headline",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:CreativeWork" },
		},
		{
			"@id": "schema:datePublished",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:CreativeWork" },
		},
		{
			"@id": "schema:dateModified",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:CreativeWork" },
		},
		{
			"@id": "schema:author",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:CreativeWork" },
		},
		{
			"@id": "schema:itemListElement",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:BreadcrumbList" },
		},
		{
			"@id": "schema:position",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:ListItem" },
		},
		{
			"@id": "schema:item",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:ListItem" },
		},
	],
};

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
		// The vocabulary only checks that a @type exists and that supplied
		// properties are recognized; it has no BlogPosting-specific handler
		// enforcing required fields (that's this site's own rules, tested in
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
