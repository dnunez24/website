import { Window } from "happy-dom";
import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { callouts } from "./callouts";

const { DOMParser } = new Window();
const parse = (html: string) =>
	new DOMParser().parseFromString(html, "text/html") as unknown as Document;

/** Renders through a fresh `callouts()` instance, as a single-file build would. */
const render = async (
	markdown: string,
	fileURL: URL | undefined = new URL(
		"file:///project/src/content/writing/first-post.md",
	),
) =>
	parse(
		(await markdownToHtml(markdown, { hastPlugins: callouts(), fileURL })).html,
	);

const titleParts = (doc: Document) =>
	[...(doc.querySelector(".callout-title")?.children ?? [])].map(
		(part) => `${part.className}:${part.textContent}`,
	);

describe("callouts", () => {
	it("titles a callout with its type name", async () => {
		const doc = await render(
			"> [!NOTE]\n> Checkout ran on its own from 2017.\n",
		);
		expect(doc.querySelector(".callout")?.getAttribute("data-callout")).toBe(
			"note",
		);
		expect(titleParts(doc)).toEqual(["callout-type:Note"]);
		expect(doc.querySelector(".callout-content p")?.textContent).toBe(
			"Checkout ran on its own from 2017.",
		);
	});

	it("keeps the type name before a custom title, with a hidden colon", async () => {
		const doc = await render(
			"> [!WARNING] Before you _migrate_\n> Back up first.\n",
		);
		expect(titleParts(doc)).toEqual([
			"callout-type:Warning",
			"sr-only:: ",
			"callout-title-text:Before you migrate",
		]);
		expect(doc.querySelector(".callout-title-text em")?.textContent).toBe(
			"migrate",
		);
	});

	it("makes a collapsible callout a details element with an empty, hidden marker", async () => {
		const closed = await render(
			"> [!TIP]- Where to start\n> The slowest part.\n",
		);
		const details = closed.querySelector("details.callout");
		expect(details?.hasAttribute("open")).toBe(false);
		// <summary> takes phrasing content only.
		expect(details?.querySelector("summary div")).toBeNull();
		const marker = details?.querySelector("summary .callout-fold-icon");
		expect(marker?.getAttribute("aria-hidden")).toBe("true");
		expect(marker?.innerHTML).toBe("");

		const open = await render(
			"> [!TIP]+ Where to start\n> The slowest part.\n",
		);
		expect(open.querySelector("details.callout")?.hasAttribute("open")).toBe(
			true,
		);
	});

	it("fails on a collapsible callout without a title", async () => {
		await expect(
			render("> [!NOTE]-\n> Hidden until opened.\n"),
		).rejects.toThrow(/Give this collapsible note callout a title/);
	});

	it("leaves an unknown type as a quote", async () => {
		const doc = await render("> [!unknown]\n> Stays a quote.\n");
		expect(doc.querySelector(".callout")).toBeNull();
		expect(doc.querySelector("blockquote")).not.toBeNull();
	});

	it("labels a non-folding callout as a group, pointed at its titled id", async () => {
		const doc = await render(
			"> [!NOTE]\n> Checkout ran on its own from 2017.\n",
		);
		const callout = doc.querySelector(".callout");
		expect(callout?.tagName).toBe("DIV");
		expect(callout?.getAttribute("role")).toBe("group");
		const title = doc.querySelector(".callout-title");
		expect(title?.id).toBe("dn-callout-first-post-1");
		expect(callout?.getAttribute("aria-labelledby")).toBe(title?.id);
	});

	it("numbers every non-folding callout on the page in order, qualified by the document's slug", async () => {
		const doc = await render(
			"> [!NOTE]\n> One.\n\n> [!TIP]\n> Two.\n\n> [!WARNING]\n> Three.\n",
		);
		expect(
			[...doc.querySelectorAll(".callout-title")].map((t) => t.id),
		).toEqual([
			"dn-callout-first-post-1",
			"dn-callout-first-post-2",
			"dn-callout-first-post-3",
		]);
	});

	it("leaves a folding callout without a group role or a title id", async () => {
		const doc = await render("> [!TIP]- Where to start\n> The slowest part.\n");
		const details = doc.querySelector("details.callout");
		expect(details?.hasAttribute("role")).toBe(false);
		expect(details?.hasAttribute("aria-labelledby")).toBe(false);
		expect(details?.querySelector(".callout-title")?.hasAttribute("id")).toBe(
			false,
		);
	});

	it("does not consume a number when a folding callout sits between two others", async () => {
		const doc = await render(
			"> [!NOTE]\n> One.\n\n> [!TIP]- Where to start\n> Skipped.\n\n> [!WARNING]\n> Two.\n",
		);
		expect(
			[...doc.querySelectorAll("div.callout .callout-title")].map((t) => t.id),
		).toEqual(["dn-callout-first-post-1", "dn-callout-first-post-2"]);
	});

	it("resets the id counter per document, not per build, even as the slug changes", async () => {
		// astro.config.ts calls callouts() once and reuses the plugin list for
		// every file a build processes, so the counter has to live in a factory
		// satteri re-invokes per document, not in callouts()'s own closure.
		const plugins = callouts();
		const renderWith = async (markdown: string, fileURL: URL) =>
			parse(
				(await markdownToHtml(markdown, { hastPlugins: plugins, fileURL }))
					.html,
			);

		const first = await renderWith(
			"> [!NOTE]\n> One.\n\n> [!TIP]\n> Two.\n",
			new URL("file:///project/src/content/writing/first-post.md"),
		);
		expect(
			[...first.querySelectorAll(".callout-title")].map((t) => t.id),
		).toEqual(["dn-callout-first-post-1", "dn-callout-first-post-2"]);

		const second = await renderWith(
			"> [!WARNING]\n> Fresh document.\n",
			new URL("file:///project/src/content/writing/second-post.md"),
		);
		expect(second.querySelector(".callout-title")?.id).toBe(
			"dn-callout-second-post-1",
		);
	});

	it("falls back to a synthetic slug when satteri compiles without a fileURL", async () => {
		// No `fileURL` option at all, unlike `render()`'s default: a default
		// parameter substitutes for an explicit `undefined` too, so this needs
		// its own call to actually omit it.
		const doc = parse(
			(
				await markdownToHtml("> [!CAUTION]\n> No file behind this one.\n", {
					hastPlugins: callouts(),
				})
			).html,
		);
		expect(doc.querySelector(".callout-title")?.id).toBe("dn-callout-doc-1");
	});

	it("nests a callout inside a callout, numbering both in document order", async () => {
		const doc = await render(
			"> [!NOTE]\n> Outer.\n> >\n> > [!TIP]\n> > Inner.\n",
		);
		const ids = [...doc.querySelectorAll(".callout-title")].map((t) => t.id);
		expect(ids).toEqual(["dn-callout-first-post-1", "dn-callout-first-post-2"]);
		const outer = doc.querySelector(
			'[aria-labelledby="dn-callout-first-post-1"]',
		);
		expect(
			outer?.querySelector('[aria-labelledby="dn-callout-first-post-2"]'),
		).not.toBeNull();
	});

	it("keeps a callout id apart from a heading whose slug matches the old bare pattern", async () => {
		// Astro's own markdown pipeline auto-slugs headings with github-slugger
		// (@astrojs/markdown-satteri's createHeadingIdsPlugin, which runs after
		// our plugins), so a heading like "## DN callout 3" gets id="dn-callout-3"
		// – exactly the id the old, page-wide counter would also hand out. Model
		// that heading id directly, since calling satteri's markdownToHtml
		// standalone (as this file does) never runs that plugin itself.
		const doc = await render(
			'<h2 id="dn-callout-3">DN callout 3</h2>\n\n> [!NOTE]\n> One.\n\n> [!TIP]\n> Two.\n\n> [!IMPORTANT]\n> Three.\n',
		);
		expect(doc.querySelector("h2")?.id).toBe("dn-callout-3");
		const calloutIds = [...doc.querySelectorAll(".callout-title")].map(
			(t) => t.id,
		);
		expect(calloutIds).toEqual([
			"dn-callout-first-post-1",
			"dn-callout-first-post-2",
			"dn-callout-first-post-3",
		]);
		// The old bare pattern never appears as a callout id, so it can't
		// collide with the heading's.
		expect(calloutIds).not.toContain("dn-callout-3");
		expect(new Set([...calloutIds, "dn-callout-3"]).size).toBe(4);
	});

	it("gives two documents rendered onto one page their own ids, even at the same count", async () => {
		// Mirrors an MDX article importing another entry's rendered <Content />,
		// or two specimens concatenated on a dev page: both compile through the
		// same callouts() instance (astro.config.ts calls it once), each with
		// its own fileURL.
		const plugins = callouts();
		const compile = (markdown: string, fileURL: URL) =>
			markdownToHtml(markdown, { hastPlugins: plugins, fileURL });

		const [a, b] = await Promise.all([
			compile(
				"> [!NOTE]\n> From the dev specimen.\n",
				new URL("file:///project/src/pages/dev/design-system-markdown.md"),
			),
			compile(
				"> [!WARNING]\n> From a scratch fixture.\n",
				new URL("file:///project/src/content/writing/scratch-fixture.md"),
			),
		]);
		const page = parse(`<body>${a.html}${b.html}</body>`);

		const ids = [...page.querySelectorAll(".callout-title")].map((t) => t.id);
		expect(ids).toEqual([
			"dn-callout-design-system-markdown-1",
			"dn-callout-scratch-fixture-1",
		]);
		expect(new Set(ids).size).toBe(2);
		for (const id of ids) {
			expect(page.querySelectorAll(`#${id}`)).toHaveLength(1);
		}
	});
});
