import { describe, expect, it } from "vitest";
import { validatePage } from "./structured-data";

/**
 * A minimal slice of the schema.org vocabulary graph, shaped like
 * `schemaorg-all-https.jsonld` (the `@graph` of `rdfs:Class`/`rdf:Property`
 * nodes `Validator`'s schema.org handler reads). Real validation runs
 * against the pinned vocabulary in `scripts/validate-structured-data.ts`;
 * this fixture just keeps the tests fast and offline.
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
	],
};

/** Wraps one JSON-LD node in an otherwise-empty page, as `dist/**\/*.html` pages would have it. */
const page = (jsonLd: object) =>
	`<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(
		jsonLd,
	)}</script></head><body></body></html>`;

const validPosting = {
	"@context": "https://schema.org",
	"@type": "BlogPosting",
	headline: "A great post",
	description: "A great post about testing.",
	url: "https://example.com/writing/a-great-post/",
	datePublished: "2024-01-01T00:00:00.000Z",
	dateModified: "2024-01-01T00:00:00.000Z",
	author: "Jane Doe",
};

describe("validatePage", () => {
	it("passes a valid BlogPosting", async () => {
		const issues = await validatePage(
			page(validPosting),
			"/writing/a-great-post/",
			VOCABULARY,
		);
		expect(issues).toEqual([]);
	});

	it("flags a broken BlogPosting as an ERROR", async () => {
		// The vocabulary only checks that a @type exists and that supplied
		// properties are recognized; it has no BlogPosting-specific handler
		// enforcing required fields like `headline` (unlike, say, Person's
		// required `name`). A misspelled @type is the reliable way to force
		// an ERROR: schema.org's generic handler rejects unknown types.
		const broken = { ...validPosting, "@type": "BlogPost" };
		const issues = await validatePage(
			page(broken),
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

	it("reports the page path on every issue", async () => {
		const broken = { ...validPosting, "@type": "BlogPost" };
		const issues = await validatePage(
			page(broken),
			"/writing/broken-post/",
			VOCABULARY,
		);
		expect(issues.length).toBeGreaterThan(0);
		expect(
			issues.every((issue) => issue.page === "/writing/broken-post/"),
		).toBe(true);
	});
});
