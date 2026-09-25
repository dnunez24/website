import { defineHastPlugin, type HastNode } from "satteri";

type Element = Extract<HastNode, { type: "element" }>;

const isElement = (node: HastNode): node is Element => node.type === "element";

const isCell = (node: HastNode): node is Element =>
	isElement(node) && (node.tagName === "th" || node.tagName === "td");

/** The first `<tr>` anywhere under `node`, depth-first. */
function firstRow(node: Element): Element | undefined {
	if (node.tagName === "tr") return node;
	for (const child of node.children) {
		if (!isElement(child)) continue;
		const found = firstRow(child);
		if (found !== undefined) return found;
	}
	return undefined;
}

/**
 * `.prose table` has no scroll container (WCAG 1.4.10 Reflow), so a table
 * wider than the column scrolls the whole page instead of scrolling in its
 * own column. Wraps every table this step reaches in
 * `<div data-table-scroll tabindex="0" role="group" aria-label="…">`, the
 * design system's Table spec (DS-2): `tabindex="0"` for keyboard scrolling,
 * `role="group"` plus `aria-label` so the name isn't lost, matching how
 * `syntax.ts` marks a highlighted `<pre role="group">`. Not `role="region"`:
 * a `region` is a page landmark, and a table on every page would crowd the
 * landmark list — axe's `landmark-unique` (best-practice) flags two
 * same-named ones, which a page with more than one uncaptioned table always
 * has. `data-table-scroll`, not a class: it's a hast-step-generated hook,
 * the same convention as `data-codeblock`, `data-diagram` and `data-callout`.
 *
 * The label is the table's caption alone when it has one, otherwise "Table:
 * " plus its first up to three header cells with actual text ("Table:
 * Token, Use, Milliseconds"), otherwise the bare "Table" when the header
 * row has none. Two tables that still land on the same label get " (2)",
 * " (3)" and so on appended to the repeats, counted per document in
 * `before` — this plugin is created once in `astro.config.ts` and reused
 * for every document the build processes, so the count has to reset
 * between them, not persist across the whole build. (satteri runs a
 * synchronous plugin's `before` hook and every visit in one synchronous
 * pass, so a closure is safe here; `ctx.data`, the documented per-compile
 * bag, would be the one to move to if this step's `visit` ever needs to
 * become async.)
 *
 * `data-table-scroll` carries no border or background, so a table that
 * fits renders as before; `prose.css` gives it `overflow-x: auto` and
 * enough padding, at its inline edges and its block end, for a focused
 * link's ring to clear the scrollport there. A link in a header cell still
 * loses the top of its ring — the spec accepts that trade-off rather than
 * also padding the block start, which an earlier version of this fix did,
 * moving tables away from where `main` renders them in several contexts (a
 * first-in-article table, one right after an `hr`, and others); keep links
 * out of header cells instead.
 *
 * Only tables this step actually reaches are wrapped: GFM tables in `.md`
 * and `.mdx`. Raw HTML in `.md` (including a hand-written `<table><caption>`,
 * the only way to give a table the caption above) stays an opaque, unparsed
 * node unless `features.rawHtml` is set, which this pipeline doesn't do, and
 * an MDX JSX `<table>` is a different node type this step doesn't visit
 * either. Both are out of scope here; see the PR body.
 */
export const tableScroll = () => {
	let seen: Map<string, number>;

	return defineHastPlugin({
		name: "table-scroll",
		before() {
			seen = new Map();
		},
		element: {
			filter: ["table"],
			visit(table, ctx) {
				const caption = table.children.find(
					(child): child is Element =>
						isElement(child) && child.tagName === "caption",
				);

				let base: string;
				if (caption !== undefined) {
					base = ctx.textContent(caption).trim();
				} else {
					const row = firstRow(table);
					const headerText = (
						row === undefined ? [] : row.children.filter(isCell)
					)
						.map((cell) => ctx.textContent(cell).trim())
						.filter((text) => text !== "")
						.slice(0, 3)
						.join(", ");
					base = headerText === "" ? "Table" : `Table: ${headerText}`;
				}

				const count = (seen.get(base) ?? 0) + 1;
				seen.set(base, count);
				const label = count === 1 ? base : `${base} (${count})`;

				ctx.wrapNode(table, {
					type: "element",
					tagName: "div",
					properties: {
						dataTableScroll: "",
						tabIndex: 0,
						role: "group",
						ariaLabel: label,
					},
					children: [],
				});
			},
		},
	});
};
