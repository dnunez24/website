import WebAutoExtractor from "@marbec/web-auto-extractor";
import type { Graph } from "schema-dts";
import { describe, expect, it } from "vitest";
import { articleGraph, collectionGraph, homeGraph, profileGraph } from "./seo";
import { checkSiteRules } from "./structured-data-rules";

const site = new URL("https://davidanunez.com");

type GraphNode = Record<string, unknown> & { "@type"?: unknown };
const nodes = (graph: Graph) =>
	(graph as unknown as { "@graph": GraphNode[] })["@graph"];

/** Wraps a `seo.ts` graph in a page and runs it through the same extractor `validatePage` uses. */
function extract(graph: Graph) {
	const html = `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(
		graph,
	)}</script></head><body></body></html>`;
	return new WebAutoExtractor({ addLocation: true }).parse(html).jsonld;
}

/** Deep-clones a graph and mutates its node of the given `@type` in place. */
function withNode(
	graph: Graph,
	type: string,
	mutate: (node: GraphNode) => void,
): Graph {
	const clone = structuredClone(graph) as Graph;
	const node = nodes(clone).find((n) => n["@type"] === type);
	if (!node) throw new Error(`No ${type} node in fixture graph`);
	mutate(node);
	return clone;
}

/** Deep-clones a graph with its node of the given `@type` removed, as if that block never rendered. */
function withoutNode(graph: Graph, type: string): Graph {
	const clone = structuredClone(graph) as Graph;
	(clone as unknown as { "@graph": GraphNode[] })["@graph"] = nodes(
		clone,
	).filter((n) => n["@type"] !== type);
	return clone;
}

const article = () =>
	articleGraph(site, "/writing/a-great-post/", {
		title: "A great post",
		description: "A great post about testing.",
		publishedDate: new Date("2024-01-01T00:00:00Z"),
		topics: ["testing"],
	});

describe("checkSiteRules: routes", () => {
	it("exempts /404.html, even with no structured data", () => {
		expect(checkSiteRules({}, "/404.html")).toEqual([]);
	});

	it("fails a route with no matching rule, naming the route", () => {
		expect(checkSiteRules({}, "/unmapped/route/")).toEqual([
			expect.objectContaining({
				rootType: "(page)",
				issueMessage: expect.stringContaining("No structured-data rule"),
			}),
		]);
	});

	it("passes the home page's WebSite", () => {
		expect(checkSiteRules(extract(homeGraph(site)), "/")).toEqual([]);
	});

	it("fails when the home page's JSON-LD is gone", () => {
		const issues = checkSiteRules(
			extract(withoutNode(homeGraph(site), "WebSite")),
			"/",
		);
		expect(issues).toContainEqual(
			expect.objectContaining({
				rootType: "WebSite",
				issueMessage: "Missing WebSite in structured data",
			}),
		);
	});

	it("passes About's ProfilePage with its Person mainEntity", () => {
		expect(
			checkSiteRules(extract(profileGraph(site, "/about/")), "/about/"),
		).toEqual([]);
	});

	it("fails when the Person mainEntity has no name", () => {
		const graph = withNode(profileGraph(site, "/about/"), "Person", (node) => {
			node.name = "";
		});
		expect(checkSiteRules(extract(graph), "/about/")).toContainEqual(
			expect.objectContaining({
				rootType: "ProfilePage",
				issueMessage: '"mainEntity" must be a Person with a non-empty "name"',
			}),
		);
	});

	it("fails when the Person mainEntity points at nothing", () => {
		const graph = withoutNode(profileGraph(site, "/about/"), "Person");
		expect(checkSiteRules(extract(graph), "/about/")).toContainEqual(
			expect.objectContaining({
				issueMessage: '"mainEntity" must be a Person with a non-empty "name"',
			}),
		);
	});

	it("passes Writing's index and a writing pagination page as CollectionPage", () => {
		const jsonld = extract(
			collectionGraph(site, "/writing/", "Writing", "Everything."),
		);
		expect(checkSiteRules(jsonld, "/writing/")).toEqual([]);
		expect(checkSiteRules(jsonld, "/writing/page/2/")).toEqual([]);
	});

	it("passes Topics' index and a topic page as CollectionPage", () => {
		const jsonld = extract(
			collectionGraph(site, "/topics/", "Topics", "Every topic."),
		);
		expect(checkSiteRules(jsonld, "/topics/")).toEqual([]);
		expect(checkSiteRules(jsonld, "/topics/leadership/")).toEqual([]);
	});

	it("passes a complete article page", () => {
		expect(
			checkSiteRules(extract(article()), "/writing/a-great-post/"),
		).toEqual([]);
	});

	it("maps a nested article id to BlogPosting, not 'no rule'", () => {
		// The content glob and [...slug].astro both allow ids with slashes
		// (e.g. a series), so the article route must too.
		const graph = articleGraph(site, "/writing/series/part-1/", {
			title: "Part one",
			description: "First in a series.",
			publishedDate: new Date("2024-01-01T00:00:00Z"),
		});
		expect(checkSiteRules(extract(graph), "/writing/series/part-1/")).toEqual(
			[],
		);
	});
});

describe("checkSiteRules: BlogPosting", () => {
	const page = "/writing/a-great-post/";

	it("fails on a dropped headline", () => {
		const graph = withNode(article(), "BlogPosting", (node) => {
			delete node.headline;
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({ issueMessage: '"headline" must be non-empty' }),
		);
	});

	it("fails on a bad datePublished", () => {
		const graph = withNode(article(), "BlogPosting", (node) => {
			node.datePublished = "Jul 08 2022";
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({
				issueMessage: '"datePublished" must be an ISO 8601 date',
			}),
		);
	});

	it("fails on a bad dateModified", () => {
		const graph = withNode(article(), "BlogPosting", (node) => {
			node.dateModified = "2024-01-02";
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({
				issueMessage: '"dateModified" must be an ISO 8601 date',
			}),
		);
	});

	it("fails on a relative url", () => {
		const graph = withNode(article(), "BlogPosting", (node) => {
			node.url = "/writing/a-great-post/";
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({
				issueMessage: '"url" must be an absolute URL',
			}),
		);
	});

	it("fails on a relative image", () => {
		const graph = withNode(article(), "BlogPosting", (node) => {
			node.image = "/og/default.png";
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({
				issueMessage: '"image" must be an absolute URL',
			}),
		);
	});

	it("fails when author is a string instead of a Person", () => {
		const graph = withNode(article(), "BlogPosting", (node) => {
			node.author = "Dave Nuñez";
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({
				issueMessage: expect.stringContaining('"author.name"'),
			}),
		);
	});

	it("fails when author.name is missing (not just when author is a string)", () => {
		const graph = withNode(article(), "BlogPosting", (node) => {
			delete (node.author as Record<string, unknown>).name;
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({
				issueMessage: expect.stringContaining('"author.name"'),
			}),
		);
	});

	it("fails when the JSON-LD block is missing entirely", () => {
		expect(checkSiteRules({}, page)).toEqual([
			expect.objectContaining({
				rootType: "BlogPosting",
				issueMessage: "Missing BlogPosting in structured data",
			}),
			expect.objectContaining({
				rootType: "BreadcrumbList",
				issueMessage: "Missing BreadcrumbList in structured data",
			}),
		]);
	});
});

describe("checkSiteRules: WebSite and CollectionPage", () => {
	it("fails when the WebSite has no name", () => {
		const graph = withNode(homeGraph(site), "WebSite", (node) => {
			node.name = "";
		});
		expect(checkSiteRules(extract(graph), "/")).toContainEqual(
			expect.objectContaining({ issueMessage: '"name" must be non-empty' }),
		);
	});

	it("fails when the WebSite has no url", () => {
		const graph = withNode(homeGraph(site), "WebSite", (node) => {
			delete node.url;
		});
		expect(checkSiteRules(extract(graph), "/")).toContainEqual(
			expect.objectContaining({
				issueMessage: '"url" must be an absolute URL',
			}),
		);
	});

	it("fails when the CollectionPage has no name", () => {
		const graph = withNode(
			collectionGraph(site, "/writing/", "Writing", "Everything."),
			"CollectionPage",
			(node) => {
				node.name = "";
			},
		);
		expect(checkSiteRules(extract(graph), "/writing/")).toContainEqual(
			expect.objectContaining({ issueMessage: '"name" must be non-empty' }),
		);
	});

	it("fails when the CollectionPage has no url", () => {
		const graph = withNode(
			collectionGraph(site, "/writing/", "Writing", "Everything."),
			"CollectionPage",
			(node) => {
				delete node.url;
			},
		);
		expect(checkSiteRules(extract(graph), "/writing/")).toContainEqual(
			expect.objectContaining({
				issueMessage: '"url" must be an absolute URL',
			}),
		);
	});
});

describe("checkSiteRules: BreadcrumbList", () => {
	const page = "/writing/a-great-post/";

	// Item count and URL validity aren't checked here: that's Adobe's own
	// BreadcrumbListValidator's job (see structured-data.test.ts for a
	// relative item still getting caught through the full validatePage).

	it("fails when an item has no position", () => {
		const graph = withNode(article(), "BreadcrumbList", (node) => {
			const items = node.itemListElement as Record<string, unknown>[];
			delete items[0]?.position;
		});
		expect(checkSiteRules(extract(graph), page)).toContainEqual(
			expect.objectContaining({
				issueMessage: expect.stringContaining('is missing "position"'),
			}),
		);
	});
});
