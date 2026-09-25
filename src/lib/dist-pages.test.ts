import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pagePath } from "./dist-pages";

describe("pagePath", () => {
	const dist = join("/repo", "dist");

	it("turns a directory's index.html into a trailing-slash path", () => {
		expect(pagePath(dist, join(dist, "about", "index.html"))).toBe("/about/");
		expect(
			pagePath(dist, join(dist, "writing", "first-post", "index.html")),
		).toBe("/writing/first-post/");
	});

	it("turns the root index.html into /", () => {
		expect(pagePath(dist, join(dist, "index.html"))).toBe("/");
	});

	it("leaves a non-index file's name as the path", () => {
		expect(pagePath(dist, join(dist, "404.html"))).toBe("/404.html");
	});
});
