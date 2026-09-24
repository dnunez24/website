import { describe, expect, it } from "vitest";
import {
	countTopics,
	paginateArticles,
	topicHref,
	writingPageHref,
} from "./writing";

const article = (...topics: string[]) => ({ data: { topics } });

describe("countTopics", () => {
	it("counts articles per topic, alphabetical", () => {
		expect(
			countTopics([
				article("systems", "architecture"),
				article("systems"),
				{ data: {} },
			]),
		).toEqual([
			{ name: "architecture", count: 1 },
			{ name: "systems", count: 2 },
		]);
	});

	it("counts an article once when it lists a topic twice", () => {
		expect(countTopics([article("craft", "craft")])).toEqual([
			{ name: "craft", count: 1 },
		]);
	});
});

describe("topicHref", () => {
	it("uses the topic name as its URL segment", () => {
		expect(topicHref("developer-experience")).toBe(
			"/topics/developer-experience/",
		);
	});
});

describe("writingPageHref", () => {
	it("points page 1 at the list itself, never at /page/1/", () => {
		expect(writingPageHref(1)).toBe("/writing/");
	});

	it("points later pages at /writing/page/<n>/", () => {
		expect(writingPageHref(2)).toBe("/writing/page/2/");
		expect(writingPageHref(11)).toBe("/writing/page/11/");
	});
});

describe("paginateArticles", () => {
	const articles = (count: number) =>
		Array.from({ length: count }, (_, i) => i);

	it("gives zero articles one empty page 1", () => {
		expect(paginateArticles(articles(0), 10)).toEqual([
			{ pageNumber: 1, total: 1, articles: [], href: "/writing/" },
		]);
	});

	it("keeps a single article on one page", () => {
		expect(paginateArticles(articles(1), 10)).toEqual([
			{ pageNumber: 1, total: 1, articles: [0], href: "/writing/" },
		]);
	});

	it("fills exactly one page at the page size", () => {
		const pages = paginateArticles(articles(10), 10);
		expect(pages).toHaveLength(1);
		expect(pages[0]).toEqual({
			pageNumber: 1,
			total: 1,
			articles: articles(10),
			href: "/writing/",
		});
	});

	it("starts a second page with one article over the page size", () => {
		const pages = paginateArticles(articles(11), 10);
		expect(pages.map((page) => page.articles.length)).toEqual([10, 1]);
		expect(pages.map((page) => page.pageNumber)).toEqual([1, 2]);
		expect(pages.every((page) => page.total === 2)).toBe(true);
		expect(pages.map((page) => page.href)).toEqual([
			"/writing/",
			"/writing/page/2/",
		]);
	});

	it("splits 21 articles into three pages, never aliasing page 1", () => {
		const pages = paginateArticles(articles(21), 10);
		expect(pages.map((page) => page.articles.length)).toEqual([10, 10, 1]);
		expect(pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);
		expect(pages.every((page) => page.total === 3)).toBe(true);
		expect(pages.map((page) => page.href)).toEqual([
			"/writing/",
			"/writing/page/2/",
			"/writing/page/3/",
		]);
		expect(pages.some((page) => page.href === "/writing/page/1/")).toBe(false);
	});
});
