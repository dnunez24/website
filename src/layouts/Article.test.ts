import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import Article from "./Article.astro";

let container: AstroContainer;

beforeAll(async () => {
	// BaseHead builds the RSS link from `site`.
	container = await AstroContainer.create({
		astroConfig: { site: "https://davidanunez.com" },
	});
});

// Only the parser comes from happy-dom, as in `components.test.ts`.
const { DOMParser } = new Window();

async function renderArticle(props: Record<string, unknown>) {
	const html = await container.renderToString(Article, {
		props: {
			title: "First post",
			description: "Lorem ipsum.",
			publishedDate: new Date("2022-07-08T00:00:00Z"),
			topics: ["leadership", "systems"],
			...props,
		},
		slots: { default: "<p>Body</p>" },
		request: new Request("https://davidanunez.com/writing/first-post/"),
	});
	return new DOMParser().parseFromString(
		html,
		"text/html",
	) as unknown as Document;
}

describe("Article", () => {
	it("leads with the date and topics, then the title and subtitle", async () => {
		const doc = await renderArticle({ subtitle: "On beginnings" });
		const header = doc.querySelector("article > header");
		expect([...(header?.children ?? [])].map((child) => child.tagName)).toEqual(
			["DIV", "HGROUP"],
		);
		const eyebrow = header?.firstElementChild;
		expect(eyebrow?.querySelector("time")?.getAttribute("datetime")).toBe(
			"2022-07-08",
		);
		expect(eyebrow?.querySelectorAll("li")).toHaveLength(2);
		expect(doc.querySelector("hgroup > h1")?.textContent).toBe("First post");
		expect(doc.querySelector("hgroup > p")?.textContent).toBe("On beginnings");
	});

	it("leaves the subtitle out when the article has none", async () => {
		const doc = await renderArticle({});
		expect(doc.querySelector("hgroup > h1")).not.toBeNull();
		expect(doc.querySelector("hgroup > p")).toBeNull();
	});
});
