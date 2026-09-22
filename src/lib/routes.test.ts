import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";
import { GET as robots } from "../pages/robots.txt";
import { isCurrentSection, isDevRoute, isPublicPage } from "./routes";

describe("isCurrentSection", () => {
	it("matches the link's own page and the pages under it", () => {
		expect(isCurrentSection("/topics/", "/topics/")).toBe(true);
		expect(isCurrentSection("/topics/systems/", "/topics/")).toBe(true);
		expect(isCurrentSection("/writing/first-post/", "/writing")).toBe(true);
	});

	it("ignores pages that only share a prefix, and external links", () => {
		expect(isCurrentSection("/topicsx/", "/topics/")).toBe(false);
		expect(isCurrentSection("/writing-notes/", "/writing")).toBe(false);
		expect(isCurrentSection("/", "https://github.com/dnunez24")).toBe(false);
	});
});

describe("isDevRoute", () => {
	it("matches routes under /dev/ and nothing that only starts with dev", () => {
		expect(isDevRoute("/dev/design-system")).toBe(true);
		expect(isDevRoute("/dev/design-system-markdown/")).toBe(true);
		expect(isDevRoute("/developer/")).toBe(false);
		expect(isDevRoute("/writing/dev/")).toBe(false);
	});
});

describe("isPublicPage", () => {
	it("keeps site pages and drops the dev specimens", () => {
		expect(isPublicPage("https://davidanunez.com/")).toBe(true);
		expect(isPublicPage("https://davidanunez.com/writing/first-post/")).toBe(
			true,
		);
		expect(isPublicPage("https://davidanunez.com/dev/design-system/")).toBe(
			false,
		);
	});
});

describe("robots.txt", () => {
	it("allows every crawler and names the absolute sitemap URL", async () => {
		const response = robots({
			site: new URL("https://davidanunez.com"),
		} as APIContext);
		expect(response.headers.get("Content-Type")).toBe(
			"text/plain; charset=utf-8",
		);
		expect(await response.text()).toBe(
			"User-agent: *\nAllow: /\n\nSitemap: https://davidanunez.com/sitemap-index.xml\n",
		);
	});

	it("fails the build when site is not configured", () => {
		expect(() => robots({ site: undefined } as APIContext)).toThrow(/site/);
	});
});
