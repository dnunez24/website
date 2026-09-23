import { describe, expect, it } from "vitest";
import {
	articleGraph,
	collectionGraph,
	homeGraph,
	PROFILES,
	pageTitle,
	profileGraph,
	SHARE_IMAGE,
} from "./seo";

const site = new URL("https://davidanunez.com");
const nodes = (graph: { "@graph": unknown }) =>
	graph["@graph"] as Record<string, unknown>[];
const byType = (graph: { "@graph": unknown }, type: string) =>
	nodes(graph).find((node) => node["@type"] === type);

describe("pageTitle", () => {
	it("adds the site name, except on the home page", () => {
		expect(pageTitle("Writing")).toBe("Writing — Dave Nuñez");
		expect(pageTitle("Dave Nuñez")).toBe("Dave Nuñez");
	});
});

describe("SHARE_IMAGE", () => {
	it("describes the exported card, with the name and tagline as alt text", () => {
		expect(SHARE_IMAGE).toMatchObject({
			path: "/og/default.png",
			width: 1200,
			height: 630,
			alt: "Dave Nuñez: Leader / Builder / Integrator",
		});
	});
});

describe("structured data", () => {
	it("names the site and its author on the home page", () => {
		const graph = homeGraph(site);
		expect(graph["@context"]).toBe("https://schema.org");
		expect(byType(graph, "WebSite")).toMatchObject({
			"@id": "https://davidanunez.com/#website",
			url: "https://davidanunez.com/",
		});
		expect(byType(graph, "Person")).toMatchObject({
			"@id": "https://davidanunez.com/#person",
			name: "Dave Nuñez",
			sameAs: PROFILES,
		});
		expect(PROFILES).toEqual([
			"https://www.linkedin.com/in/dave-nunez",
			"https://github.com/dnunez24",
		]);
	});

	it("makes About a profile page about the author", () => {
		const page = byType(profileGraph(site, "/about/"), "ProfilePage");
		expect(page).toMatchObject({
			url: "https://davidanunez.com/about/",
			mainEntity: { "@id": "https://davidanunez.com/#person" },
		});
	});

	it("marks list pages as collections", () => {
		const page = byType(
			collectionGraph(site, "/topics/", "Topics", "Every topic."),
			"CollectionPage",
		);
		expect(page).toMatchObject({
			url: "https://davidanunez.com/topics/",
			name: "Topics — Dave Nuñez",
			description: "Every topic.",
		});
	});

	it("describes an article and its breadcrumb", () => {
		const graph = articleGraph(site, "/writing/first-post/", {
			title: "First post",
			description: "Lorem ipsum.",
			publishedDate: new Date("2022-07-08T00:00:00Z"),
			topics: ["leadership"],
		});
		expect(byType(graph, "BlogPosting")).toMatchObject({
			headline: "First post",
			url: "https://davidanunez.com/writing/first-post/",
			datePublished: "2022-07-08T00:00:00.000Z",
			// No update date: modified is the published date.
			dateModified: "2022-07-08T00:00:00.000Z",
			author: { name: "Dave Nuñez", url: "https://davidanunez.com/" },
			image: "https://davidanunez.com/og/default.png",
			keywords: ["leadership"],
		});
		const crumbs = byType(graph, "BreadcrumbList")?.itemListElement as {
			position: number;
			name: string;
			item: string;
		}[];
		expect(
			crumbs.map(({ position, name, item }) => [position, name, item]),
		).toEqual([
			[1, "Dave Nuñez", "https://davidanunez.com/"],
			[2, "Writing", "https://davidanunez.com/writing/"],
			[3, "First post", "https://davidanunez.com/writing/first-post/"],
		]);
	});
});
