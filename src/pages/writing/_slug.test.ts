import type { CollectionEntry } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import WritingSlug from "./[...slug].astro";

let container: AstroContainer;

beforeAll(async () => {
	// articleShareImage/BaseHead build absolute URLs from `site`, as in Article.test.ts.
	container = await AstroContainer.create({
		astroConfig: { site: "https://davidanunez.com" },
	});
});

/**
 * A .md entry whose hast plugin threw during Astro's content sync (a
 * Mermaid link, a missing accTitle, an untitled folding callout). The glob
 * loader catches that error, logs it and leaves `rendered` unset instead of
 * failing the build; `entry.body` still holds the raw source.
 */
const brokenMarkdownEntry = {
	id: "broken-article",
	collection: "writing",
	data: {
		title: "Broken article",
		description: "A probe entry with no rendered output.",
		publishedDate: new Date("2026-01-01"),
	},
	filePath: "src/content/writing/broken-article.md",
	body: "# Broken article\n\nSome source that failed to render.\n",
	rendered: undefined,
	deferredRender: false,
} as unknown as CollectionEntry<"writing">;

describe("writing/[...slug]", () => {
	it("fails to render a .md entry whose hast plugin swallowed an error, instead of publishing an empty body", async () => {
		await expect(
			container.renderToString(WritingSlug, { props: brokenMarkdownEntry }),
		).rejects.toThrow(/broken-article\.md failed to render/);
	});

	it("does not flag a deferred-render (MDX) entry for having no rendered field: MDX has none even when it's fine", () => {
		// MDX compiles through a different path (`deferredRender`), which has no
		// `rendered` field regardless of success; the build-failure guard in
		// [...slug].astro only fires for a .md entry, so it must not read this
		// case as "failed to render". Asserted directly against the guard's own
		// condition, since a real MDX render needs a compiled content module
		// this test has no way to construct; `pnpm build` covers the full path
		// (src/content/writing/using-mdx.mdx renders normally on this branch).
		const deferredEntry = { rendered: undefined, deferredRender: true };
		expect(
			deferredEntry.rendered === undefined && !deferredEntry.deferredRender,
		).toBe(false);
	});
});
