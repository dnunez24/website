import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import NotFound from "./404.astro";

let container: AstroContainer;

beforeAll(async () => {
	// BaseHead builds the RSS link from `site`, as in `Article.test.ts`.
	container = await AstroContainer.create({
		astroConfig: { site: "https://davidanunez.com" },
	});
});

// Only the parser comes from happy-dom, as in `components.test.ts`.
const { DOMParser } = new Window();

async function renderNotFound() {
	const html = await container.renderToString(NotFound, {
		request: new Request("https://davidanunez.com/404"),
	});
	return new DOMParser().parseFromString(
		html,
		"text/html",
	) as unknown as Document;
}

describe("404 page", () => {
	it("renders exactly one h1, reading '404 not found'", async () => {
		const doc = await renderNotFound();
		const headings = doc.querySelectorAll("h1");
		expect(headings).toHaveLength(1);
		expect(headings[0]?.textContent).toBe("404 not found");
	});

	it("shows the apology sentence", async () => {
		const doc = await renderNotFound();
		expect(doc.querySelector("main p")?.textContent).toBe(
			"I couldn’t find that page. It may have moved, or the link may be wrong.",
		);
	});

	it("links home with a filled button and writing with an outline button", async () => {
		const doc = await renderNotFound();
		const links = [...doc.querySelectorAll("main a[data-button]")];
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/",
			"/writing/",
		]);
		expect(links[0]?.textContent).toBe("Go home");
		// classList, not className: "hover:bg-brand-tint" (outline) contains the
		// substring "bg-brand" without being the filled variant's fill class.
		expect(links[0]?.classList.contains("bg-brand")).toBe(true);
		expect(links[1]?.textContent).toBe("Browse writing");
		expect(links[1]?.classList.contains("bg-brand")).toBe(false);
		expect(links[1]?.classList.contains("border-brand")).toBe(true);
	});

	it("titles the page and keeps it out of search results", async () => {
		const doc = await renderNotFound();
		expect(doc.querySelector("title")?.textContent).toBe(
			"Page not found — Dave Nuñez",
		);
		expect(
			doc.querySelector('meta[name="description"]')?.getAttribute("content"),
		).toBe("I couldn’t find that page.");
		expect(
			doc.querySelector('meta[name="robots"]')?.getAttribute("content"),
		).toBe("noindex");
		// noindex also drops the canonical link: every missing path serves this
		// page, so it has no URL of its own to be canonical for.
		expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
	});
});
