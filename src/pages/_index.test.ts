import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { SITE_TITLE } from "../consts";
import Index from "./index.astro";

const { DOMParser } = new Window();
const parse = (html: string) =>
	new DOMParser().parseFromString(html, "text/html") as unknown as Document;

let container: AstroContainer;

beforeAll(async () => {
	container = await AstroContainer.create({
		astroConfig: { site: "https://davidanunez.com" },
	});
});

describe("home page", () => {
	it("has one h1: the name, visually hidden before the intro", async () => {
		const doc = parse(
			await container.renderToString(Index, {
				request: new Request("https://davidanunez.com/"),
			}),
		);
		const headings = doc.querySelectorAll("h1");
		expect(headings).toHaveLength(1);
		expect(headings[0]?.textContent).toBe(SITE_TITLE);
		expect(headings[0]?.classList.contains("sr-only")).toBe(true);
		// Before the intro paragraph, not after: the h1 is the first h1-or-p
		// in main, in document order.
		const main = doc.querySelector("main");
		const order = [...(main?.querySelectorAll("h1, p") ?? [])].map(
			(el) => el.tagName,
		);
		expect(order[0]).toBe("H1");
	});
});
