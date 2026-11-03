import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";
import { GET as robots } from "../pages/robots.txt";
import { currentNavState, isDevRoute, isPublicPage } from "./routes";

describe("currentNavState", () => {
	it('marks the link\'s own page "page"', () => {
		expect(currentNavState("/topics/", "/topics/")).toBe("page");
		expect(currentNavState("/writing/", "/writing/")).toBe("page");
		// An href without its trailing slash still matches exactly.
		expect(currentNavState("/writing/", "/writing")).toBe("page");
	});

	it('marks a page under the link\'s section "true", not "page"', () => {
		expect(currentNavState("/topics/systems/", "/topics/")).toBe("true");
		expect(currentNavState("/writing/first-post/", "/writing")).toBe("true");
	});

	it('marks a later writing page "true", ahead of that route\'s own PR', () => {
		expect(currentNavState("/writing/page/2/", "/writing/")).toBe("true");
		expect(currentNavState("/writing/page/10/", "/writing/")).toBe("true");
	});

	it("ignores pages that only share a prefix, and external links", () => {
		expect(currentNavState("/topicsx/", "/topics/")).toBeUndefined();
		expect(currentNavState("/writing-notes/", "/writing")).toBeUndefined();
		expect(currentNavState("/", "https://github.com/dnunez24")).toBeUndefined();
	});

	it("marks nothing on the 404 page: it sits under no section", () => {
		expect(currentNavState("/404", "/writing/")).toBeUndefined();
		expect(currentNavState("/404", "/about/")).toBeUndefined();
		expect(currentNavState("/404", "/topics/")).toBeUndefined();
	});

	it("compares pathname and href the same way regardless of which one has the trailing slash", () => {
		expect(currentNavState("/writing", "/writing/")).toBe("page");
		expect(currentNavState("/writing/", "/writing")).toBe("page");
		expect(currentNavState("/writing", "/writing")).toBe("page");
	});

	it('matches href="/" only on the home page itself, not as a section', () => {
		expect(currentNavState("/", "/")).toBe("page");
		expect(currentNavState("/about/", "/")).toBeUndefined();
		expect(currentNavState("/writing/first-post/", "/")).toBeUndefined();
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
