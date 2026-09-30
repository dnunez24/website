import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface HeaderRule {
	pattern: string;
	headers: Record<string, string>;
}

/**
 * Parses the subset of Cloudflare's `_headers` syntax this file uses:
 * a non-indented, non-comment line starts a rule block named by that URL
 * pattern, and each indented `name: value` line after it attaches a header.
 * https://developers.cloudflare.com/workers/static-assets/headers/
 */
function parseHeadersFile(text: string): HeaderRule[] {
	const rules: HeaderRule[] = [];
	for (const line of text.split("\n")) {
		if (/^\s*#/.test(line) || line.trim() === "") continue;
		if (/^\s/.test(line)) {
			const rule = rules.at(-1);
			if (!rule) throw new Error(`Header line before any URL pattern: ${line}`);
			const [name, ...rest] = line.trim().split(":");
			if (!name || rest.length === 0) {
				throw new Error(`Malformed header line: ${line}`);
			}
			rule.headers[name.trim()] = rest.join(":").trim();
		} else {
			rules.push({ pattern: line.trim(), headers: {} });
		}
	}
	return rules;
}

/**
 * Compiles a Cloudflare `_headers` URL pattern to a matcher, per the docs'
 * "Match a path" section: `*` is a splat that greedily matches anything
 * (including further `/`), and `:name` is a placeholder that matches one
 * path segment (everything but `/`). Everything else matches literally.
 * https://developers.cloudflare.com/workers/static-assets/headers/
 */
function compilePattern(pattern: string): RegExp {
	const tokens = pattern.match(/\*|:[A-Za-z]\w*|[^*:]+|:/g) ?? [];
	const body = tokens
		.map((token) => {
			if (token === "*") return ".*";
			if (/^:[A-Za-z]\w*$/.test(token)) return "[^/]+";
			return token.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
		})
		.join("");
	return new RegExp(`^${body}$`);
}

function matches(pattern: string, pathname: string): boolean {
	return compilePattern(pattern).test(pathname);
}

/** One representative path per route shape this site builds, plus the platform files a deploy also serves. */
const NON_ASSET_ROUTES = [
	"/",
	"/about/",
	"/writing/",
	"/writing/first-post/",
	"/writing/2/", // pagination, not built yet, but a shape /_astro/* etc. must never match
	"/topics/",
	"/topics/systems/",
	"/does-not-exist/", // the 404 case
	"/robots.txt",
	"/sitemap-index.xml",
	"/sitemap-0.xml",
	"/rss.xml",
];

describe("public/_headers", () => {
	it("has no more than 100 rules, each line within 2,000 characters", async () => {
		const text = await readFile("public/_headers", "utf8");
		const rules = parseHeadersFile(text);
		expect(rules.length).toBeLessThanOrEqual(100);
		for (const line of text.split("\n")) {
			expect(line.length).toBeLessThanOrEqual(2000);
		}
	});

	it("caches hashed /_astro/* assets for a year, immutably", async () => {
		const rules = parseHeadersFile(await readFile("public/_headers", "utf8"));
		const rule = rules.find((r) => r.pattern === "/_astro/*");
		expect(rule?.headers["Cache-Control"]).toBe(
			"public, max-age=31536000, immutable",
		);
	});

	it("sets `immutable` on no rule but /_astro/*", async () => {
		const rules = parseHeadersFile(await readFile("public/_headers", "utf8"));
		const immutable = rules.filter((rule) =>
			rule.headers["Cache-Control"]?.includes("immutable"),
		);
		expect(immutable.map((rule) => rule.pattern)).toEqual(["/_astro/*"]);
	});

	it("matches no rule against HTML routes, robots.txt, the sitemaps or rss.xml", async () => {
		const rules = parseHeadersFile(await readFile("public/_headers", "utf8"));
		for (const pathname of NON_ASSET_ROUTES) {
			const matched = rules.filter((rule) => matches(rule.pattern, pathname));
			expect(matched, `${pathname} matched ${JSON.stringify(matched)}`).toEqual(
				[],
			);
		}
	});

	describe("compilePattern", () => {
		it("matches a splat greedily, including further path segments", () => {
			expect(matches("/_astro/*", "/_astro/fonts/a.woff2")).toBe(true);
			expect(matches("/_astro/*", "/_astro/")).toBe(true);
			expect(matches("/_astro/*", "/_astro")).toBe(false);
			expect(matches("/_astro/*", "/other/")).toBe(false);
		});

		it("matches a placeholder against one path segment, not a slash", () => {
			expect(matches("/writing/:slug/", "/writing/first-post/")).toBe(true);
			expect(matches("/writing/:slug/", "/writing/first-post/extra/")).toBe(
				false,
			);
		});

		it("matches a mid-path splat, the case this project's rules avoid", () => {
			expect(matches("/writing/*/", "/writing/first-post/")).toBe(true);
			expect(matches("/writing/*/", "/writing/first-post/extra/")).toBe(true);
			expect(matches("/writing/*/", "/writing/")).toBe(false);
		});
	});
});
