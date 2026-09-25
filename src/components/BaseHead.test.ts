import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import BaseHead from "./BaseHead.astro";

let container: AstroContainer;

beforeAll(async () => {
	// BaseHead builds the canonical URL, RSS link and share image from `site`.
	container = await AstroContainer.create({
		astroConfig: { site: "https://davidanunez.com" },
	});
});

// Only the parser comes from happy-dom, as in components.test.ts.
const { DOMParser } = new Window();

async function renderHead() {
	const html = await container.renderToString(BaseHead, {
		props: { title: "Writing", description: "Everything I have written." },
		request: new Request("https://davidanunez.com/writing/"),
	});
	return new DOMParser().parseFromString(
		html,
		"text/html",
	) as unknown as Document;
}

describe("BaseHead", () => {
	it("links the ico, svg and touch icon, in that fallback order", async () => {
		const doc = await renderHead();
		const icons = [
			...doc.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]'),
		].map((link) => ({
			rel: link.getAttribute("rel"),
			href: link.getAttribute("href"),
			type: link.getAttribute("type"),
			sizes: link.getAttribute("sizes"),
		}));
		expect(icons).toEqual([
			{ rel: "icon", href: "/favicon.ico", type: null, sizes: "32x32" },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: null },
			{
				rel: "apple-touch-icon",
				href: "/apple-touch-icon.png",
				type: null,
				sizes: null,
			},
		]);
	});
});
