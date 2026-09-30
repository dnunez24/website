import { defineHastPlugin, type HastNode } from "satteri";

type Element = Extract<HastNode, { type: "element" }>;

const isElement = (node: HastNode): node is Element => node.type === "element";

const hasClass = (node: HastNode, name: string): node is Element =>
	isElement(node) && [node.properties.className].flat().includes(name);

const isCheckbox = (node: HastNode): node is Element =>
	isElement(node) &&
	node.tagName === "input" &&
	node.properties.type === "checkbox";

// A regular trailing space here collapses in both selection-copy and
// innerText: this span is `position: absolute` (sr-only), and a browser
// drops collapsible whitespace at the start of the in-flow text that
// follows an out-of-flow element, the same as it would at the start of a
// line. A non-breaking space doesn't collapse, so "To do: " plus GFM's
// own leading space on the item text ("<input> Todo") reads and copies as
// "To do: Todo" — verified against both selection-copy and the
// accessibility tree (ariaSnapshot).
const prefixSpan = (checked: unknown): Element => ({
	type: "element",
	tagName: "span",
	properties: { className: ["sr-only"] },
	children: [{ type: "text", value: checked ? "Done: " : "To do: " }],
});

/**
 * GFM task-list checkboxes render `disabled`, so they're read-only decoration
 * rather than a control, but a `disabled` input still needs an accessible
 * name (WCAG 4.1.2) and today's has none. `aria-hidden` drops the checkbox
 * from the accessibility tree, and a visually hidden "Done: " or "To do: "
 * prefix carries the state the box drew, so a screen reader hears "To do:
 * Write the draft" instead of a nameless control next to plain text.
 *
 * A blank line between items (or a second block under one) makes the whole
 * list "loose": GFM then wraps each item's content in a `<p>`, checkbox
 * included, instead of leaving the checkbox as the `<li>`'s direct child.
 * `li.task-list-item > input` (prose.css) only matches the tight shape, so a
 * loose item drew the browser's native checkbox, unstyled, before this fix
 * too. Hoist the checkbox out of the `<p>` so it's always `<li>`'s direct
 * child, fixing both the accessible name and that pre-existing visual bug.
 * The prefix goes inside the `<p>` (or `<li>` when there's no `<p>`), first,
 * so the hidden state and the visible text read as one line: "To do: Loose
 * todo one", not two.
 */
export const taskListState = () =>
	defineHastPlugin({
		name: "task-list-state",
		element: {
			filter: ["li"],
			visit(li, ctx) {
				if (!hasClass(li, "task-list-item")) return;

				const first = li.children.find(isElement);
				const host = first?.tagName === "p" ? first : li;
				const checkbox = host.children.find(isCheckbox);
				if (checkbox === undefined) return;

				const hidden: Element = {
					...checkbox,
					properties: { ...checkbox.properties, ariaHidden: "true" },
				};
				const prefix = prefixSpan(checkbox.properties.checked);

				if (host === li) {
					ctx.replaceNode(checkbox, [hidden, prefix]);
				} else {
					ctx.removeNode(checkbox);
					ctx.prependChild(li, hidden);
					ctx.prependChild(host, prefix);
				}
			},
		},
	});
