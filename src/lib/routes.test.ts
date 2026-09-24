import { win32 } from "node:path";
import { pathToFileURL } from "node:url";
import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { GET as robots } from "../pages/robots.txt";
import {
	currentNavState,
	isDevPageFile,
	isDevPagePath,
	isDevRoute,
	isPublicPage,
} from "./routes";

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

describe("isDevPagePath", () => {
	it("matches the dev directory and files under it", () => {
		expect(isDevPagePath("dev/design-system-markdown.md")).toBe(true);
		expect(isDevPagePath("dev/x/y.md")).toBe(true);
	});

	it("matches dev.md itself, agreeing with isDevRoute's /dev/ route", () => {
		expect(isDevPagePath("dev.md")).toBe(true);
	});

	it("doesn't match a sibling that only starts with dev", () => {
		expect(isDevPagePath("devices.md")).toBe(false);
	});

	it("matches a path computed with Windows separators", () => {
		expect(isDevPagePath(win32.join("dev", "x", "y.md"))).toBe(true);
	});
});

describe("isDevPageFile", () => {
	const root = pathToFileURL(`${process.cwd()}/`);
	const fileURLFor = (path: string) =>
		pathToFileURL(`${process.cwd()}/${path}`);

	it("matches a file under src/pages/dev/, by path rather than route", () => {
		expect(
			isDevPageFile(
				fileURLFor("src/pages/dev/design-system-markdown.md"),
				root,
			),
		).toBe(true);
	});

	it("leaves a file outside src/pages/dev/ alone", () => {
		expect(
			isDevPageFile(fileURLFor("src/pages/writing/first-post.md"), root),
		).toBe(false);
	});

	it("matches dev.md and a nested file, not devices.md", () => {
		expect(isDevPageFile(fileURLFor("src/pages/dev.md"), root)).toBe(true);
		expect(isDevPageFile(fileURLFor("src/pages/dev/x/y.md"), root)).toBe(true);
		expect(isDevPageFile(fileURLFor("src/pages/devices.md"), root)).toBe(false);
	});

	it("treats a missing fileURL as not a dev page", () => {
		expect(isDevPageFile(undefined, root)).toBe(false);
	});

	it("treats a non-file URL as not a dev page, instead of throwing", () => {
		expect(
			isDevPageFile(new URL("https://example.com/src/pages/dev/x.md"), root),
		).toBe(false);
	});

	it("ignores process.cwd(): astro build --root can point elsewhere", () => {
		const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/not/the/root");
		const fakeRoot = pathToFileURL("/fake/project/");
		const fileURL = pathToFileURL(
			"/fake/project/src/pages/dev/design-system-markdown.md",
		);
		expect(isDevPageFile(fileURL, fakeRoot)).toBe(true);
		cwdSpy.mockRestore();
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
