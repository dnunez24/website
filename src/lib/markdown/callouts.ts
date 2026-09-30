import { basename, dirname, extname } from "node:path";
import {
	defineHastPlugin,
	type HastNode,
	type PluginFactoryContext,
} from "satteri";
import satteriCallouts from "satteri-callouts";

/** GitHub's five alert types, each with the name its title shows. */
const TYPE_NAMES: Record<string, string> = {
	note: "Note",
	tip: "Tip",
	important: "Important",
	warning: "Warning",
	caution: "Caution",
};

type Element = Extract<HastNode, { type: "element" }>;

const hasClass = (node: HastNode, name: string): node is Element =>
	node.type === "element" && [node.properties.className].flat().includes(name);

const span = (className: string, text: string): Element => ({
	type: "element",
	tagName: "span",
	properties: { className: [className] },
	children: [{ type: "text", value: text }],
});

/**
 * A stable, deterministic slug for the document being compiled, so two
 * documents rendered onto one page (an MDX article importing a partial, a
 * specimen page) never share a callout id. Derived from the file name –
 * `first-post.md` becomes "first-post" – the same id a content entry
 * already gets in its own URL (`articleHref`). A folder entry
 * (`folder-a/index.md`, Astro's usual way to keep images beside a post)
 * would otherwise slug to the same "index" for every folder; its parent
 * directory name is used instead, so `folder-a/index.md` and
 * `folder-b/index.md` don't collide. Falls back to "doc" when satteri
 * compiles without a `fileURL`: Astro's own markdown pipeline always sets
 * one, so this only fires when a test calls `markdownToHtml` directly.
 */
function documentSlug(fileURL: URL | undefined): string {
	if (fileURL === undefined) return "doc";
	const name = basename(fileURL.pathname);
	const stem = name.slice(0, name.length - extname(name).length);
	const base =
		stem.toLowerCase() === "index" ? basename(dirname(fileURL.pathname)) : stem;
	const slug = base
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug === "" ? "doc" : slug;
}

/**
 * Puts the type name in every callout title, and gives a non-folding
 * callout a group role labelled by that title. satteri-callouts lets a
 * custom title replace the type name, which would leave the tint as the
 * type's only cue. A custom title follows the name after a hidden colon, so
 * screen readers say "Warning: Before you migrate". The fold icon's SVG
 * goes: CSS draws `+`/`−`.
 *
 * Returned as a plugin factory (a function of `ctx`, not a plugin
 * definition itself) so satteri calls it fresh once per document: the
 * title-id counter lives in the factory's own closure and starts over at 1
 * on every document, instead of climbing across a whole build.
 * `astro.config.ts` calls `callouts()` once and reuses its result for every
 * file the build processes, so a counter in `calloutTitles()`'s own closure
 * would keep counting across documents instead of resetting on each one.
 * Astro also renders more than one document onto a single page (MDX
 * importing another entry's `<Content />`), so the id itself is qualified
 * with the document's own slug, not just the per-document count.
 */
const calloutTitles = () => (factoryCtx: PluginFactoryContext) => {
	const slug = documentSlug(factoryCtx.fileURL);
	let calloutCount = 0;
	return defineHastPlugin({
		name: "callout-titles",
		element: {
			filter: ["div", "details"],
			visit(callout, ctx) {
				// satteri-callouts sets the attribute by its HTML name, not hast's `dataCallout`.
				const type =
					callout.properties["data-callout"] ?? callout.properties.dataCallout;
				if (typeof type !== "string" || !hasClass(callout, "callout")) return;

				const title = callout.children.find((child) =>
					hasClass(child, "callout-title"),
				);
				if (title === undefined) return;
				const name = TYPE_NAMES[type] ?? type;
				const text = title.children.find((child) =>
					hasClass(child, "callout-title-text"),
				);
				// Without a custom title, satteri-callouts writes the type name here.
				const custom =
					text !== undefined && ctx.textContent(text).trim() !== name
						? text
						: undefined;

				if (callout.tagName === "details" && custom === undefined) {
					const file = ctx.fileURL?.pathname ?? "Markdown";
					throw new Error(
						`${file}: Give this collapsible ${type} callout a title, such as \`> [!${type.toUpperCase()}]- The full configuration\`. Closed, it shows only its title row.`,
					);
				}

				const fold = title.children.find((child) =>
					hasClass(child, "callout-fold-icon"),
				);

				// A folding callout is a <details>: its <summary> already announces
				// the title and whether it's open, so it needs no group role or id.
				// A non-folding callout is a plain container: give its title row an
				// id and point the container's role="group" at it, so NVDA reports
				// the group, its name and its end.
				const nonFolding = callout.tagName === "div";
				const titleId = nonFolding
					? `dn-callout-${slug}-${++calloutCount}`
					: undefined;
				if (nonFolding) {
					ctx.setProperty(callout, "role", "group");
					ctx.setProperty(callout, "ariaLabelledBy", titleId);
				}

				ctx.replaceNode(title, {
					...title,
					properties:
						titleId === undefined
							? title.properties
							: { ...title.properties, id: titleId },
					children: [
						span("callout-type", name),
						...(custom === undefined ? [] : [span("sr-only", ": "), custom]),
						...(fold === undefined ? [] : [{ ...fold, children: [] }]),
					],
				});
			},
		},
	});
};

/**
 * GitHub alert syntax (`> [!NOTE]`) as the design system's Callout. Titles
 * are spans because `<summary>` takes only phrasing content.
 */
export const callouts = () => [
	satteriCallouts({
		theme: "github",
		showIndicator: false,
		tags: { titleTextTagName: "span", foldIconTagName: "span" },
	}),
	calloutTitles(),
];
