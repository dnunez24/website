import type { ShikiConfig } from "astro";
import theme from "../styles/shiki-theme.json";

type Transformer = NonNullable<ShikiConfig["transformers"]>[number];
type Root = Parameters<NonNullable<Transformer["root"]>>[0];
type Element = Extract<Root["children"][number], { type: "element" }>;

/** Shiki theme whose colors are the design system's `--color-syntax-*` tokens. */
export const syntaxTheme = theme as NonNullable<ShikiConfig["theme"]>;

/** Fence languages that mean plain text. Astro also falls back to `plaintext` for unknown ones. */
const PLAIN_TEXT = new Set(["plaintext", "plain", "text", "txt"]);

/** `key="value"` pairs from a code fence's meta string: ```ts title="src/app.ts". */
export function parseFenceMeta(meta = ""): Record<string, string> {
	const attributes: Record<string, string> = {};
	for (const [, key = "", value = ""] of meta.matchAll(
		/([\w-]+)="((?:[^"\\]|\\.)*)"/g,
	)) {
		attributes[key] = value.replace(/\\(.)/g, "$1");
	}
	return attributes;
}

/** Writes a fence meta string that `parseFenceMeta` reads back, for `<Code meta>`. */
export function fenceMeta(
	attributes: Record<string, string | undefined>,
): string {
	return Object.entries(attributes)
		.flatMap(([key, value]) =>
			value === undefined ? [] : `${key}="${value.replace(/[\\"]/g, "\\$&")}"`,
		)
		.join(" ");
}

const element = (
	tagName: string,
	properties: Element["properties"],
	text?: string,
): Element => ({
	type: "element",
	tagName,
	properties,
	children: text === undefined ? [] : [{ type: "text", value: text }],
});

/**
 * Splits a file name into text nodes with a `<wbr>` after each `/`, so a long
 * path wraps at a directory boundary first instead of truncating.
 */
const wrapFileName = (title: string): Element["children"] => {
	const segments = title.split(/(?<=\/)/);
	const nodes: Element["children"] = [];
	for (const [index, segment] of segments.entries()) {
		nodes.push({ type: "text", value: segment });
		if (index < segments.length - 1) nodes.push(element("wbr", {}));
	}
	return nodes;
};

/**
 * Frames a highlighted block as the design system's CodeBlock: a header with
 * the file name (`title` in the fence meta) and the language, the code, then
 * an optional `caption`. Markdown fences and the CodeBlock component both run
 * it, so they share one markup; `components.css` styles it.
 */
const codeFrame: Transformer = {
	name: "dn:code-frame",
	root(root) {
		const pre = root.children.find(
			(node): node is Element =>
				node.type === "element" && node.tagName === "pre",
		);
		if (pre === undefined) return;

		const { title, caption } = parseFenceMeta(this.options.meta?.__raw);
		const lang = PLAIN_TEXT.has(this.options.lang) ? "text" : this.options.lang;
		// Shiki makes the pre focusable so it can scroll. aria-label names it, and
		// needs a role to count on a pre.
		pre.properties.role = "group";
		pre.properties.ariaLabel = `Code: ${title ? `${title}, ` : ""}${lang}`;

		// aria-hidden: the pre's own label (above) already names the file and language.
		const header = element("div", {
			dataCodeblockHeader: "",
			ariaHidden: "true",
		});
		if (title) {
			const file = element("span", { dataCodeblockFile: "" });
			file.children = wrapFileName(title);
			header.children.push(file);
		}
		header.children.push(element("span", { dataCodeblockLang: "" }, lang));
		// Without a caption, a figure would announce an unnamed figure; a plain
		// div frame stays silent and leaves the naming to the pre's own label.
		const frame = element(caption ? "figure" : "div", { dataCodeblock: "" });
		frame.children.push(header, pre);
		if (caption) frame.children.push(element("figcaption", {}, caption));
		root.children = [frame];
	},
};

/**
 * Shiki writes `fontStyle: bold` as `font-weight:bold` (700); the system sets
 * keywords at 600. A span hook, not `postprocess`: Markdown asks Shiki for
 * hast, which never runs `postprocess`.
 */
const keywordWeight: Transformer = {
	name: "dn:keyword-weight",
	span(node) {
		const { style } = node.properties;
		if (typeof style === "string") {
			node.properties.style = style.replace(
				"font-weight:bold",
				"font-weight:600",
			);
		}
	},
};

export const syntaxTransformers: Transformer[] = [codeFrame, keywordWeight];
