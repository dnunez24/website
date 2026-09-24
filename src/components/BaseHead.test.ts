import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import BaseHead from "./BaseHead.astro";

// Read on every render, so each test controls it without re-importing BaseHead.
let mockToken: string | undefined;

vi.mock("astro:env/server", () => ({
	get PUBLIC_CF_WEB_ANALYTICS_TOKEN() {
		return mockToken;
	},
}));

let container: AstroContainer;

beforeAll(async () => {
	// BaseHead builds the canonical URL, RSS link, share image and analytics
	// beacon from `site` and the env token, as in Article.test.ts.
	container = await AstroContainer.create({
		astroConfig: { site: "https://davidanunez.com" },
	});
});

afterEach(() => {
	vi.unstubAllEnvs();
	mockToken = undefined;
});

// Only the parser comes from happy-dom, as in `components.test.ts`.
const { DOMParser } = new Window();

async function renderBaseHead() {
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
		const doc = await renderBaseHead();
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

	it("wires no beacon into the head in production without a token", async () => {
		vi.stubEnv("PROD", true);
		const doc = await renderBaseHead();
		expect(doc.querySelector("script[data-cf-beacon]")).toBeNull();
	});

	it("wires exactly one beacon into the head in production with a valid token", async () => {
		vi.stubEnv("PROD", true);
		mockToken = "0123456789abcdef0123456789abcdef";
		const doc = await renderBaseHead();
		const scripts = doc.querySelectorAll("script[data-cf-beacon]");
		expect(scripts).toHaveLength(1);
		expect(
			JSON.parse(scripts[0]?.getAttribute("data-cf-beacon") ?? ""),
		).toEqual({ token: mockToken });
	});

	it("wires no beacon outside production, even with a valid token", async () => {
		// PROD isn't stubbed here, so it defaults to false, matching `astro dev`.
		mockToken = "0123456789abcdef0123456789abcdef";
		const doc = await renderBaseHead();
		expect(doc.querySelector("script[data-cf-beacon]")).toBeNull();
	});
});
