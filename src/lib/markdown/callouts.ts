import { defineHastPlugin, type HastNode } from "satteri";
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
 * Puts the type name in every callout title. satteri-callouts lets a custom
 * title replace it, which would leave the tint as the type's only cue. A
 * custom title follows the name after a hidden colon, so screen readers say
 * "Warning: Before you migrate". The fold icon's SVG goes: CSS draws `+`/`−`.
 */
const calloutTitles = () =>
	defineHastPlugin({
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
				ctx.replaceNode(title, {
					...title,
					children: [
						span("callout-type", name),
						...(custom === undefined ? [] : [span("sr-only", ": "), custom]),
						...(fold === undefined ? [] : [{ ...fold, children: [] }]),
					],
				});
			},
		},
	});

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
