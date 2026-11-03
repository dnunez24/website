import { createHash } from "node:crypto";
import { PeleError, type RenderResult, render, type TextMeasurer } from "pele";

const MONO_STACK = "JetBrains Mono, ui-monospace, monospace";
const FONT_SIZE = 13;

/**
 * JetBrains Mono gives every glyph, in every weight, the same advance: 600 of
 * 1000 units per em. Pele's own table is proportional, so mono labels would
 * get ragged box widths. Counts code points, so an astral character is one
 * glyph.
 */
const jetbrainsMono: TextMeasurer = {
	width: (text, size) => [...text].length * size * 0.6,
};

const escapeAttribute = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;");

const unescapeText = (value: string) =>
	value
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&apos;", "'")
		.replaceAll("&amp;", "&");

/**
 * The text of `<tag id="{prefix}-{tag}">`: Pele's `accTitle` and `accDescr`.
 * Other `<title>` elements exist (a journey actor has one), and none of them
 * is the diagram's name, so the id picks the right one.
 */
function accessibleText(svg: string, prefix: string, tag: "title" | "desc") {
	const match = svg.match(
		new RegExp(`<${tag} id="${prefix}-${tag}">([^<]*)</${tag}>`),
	);
	return unescapeText(match?.[1] ?? "");
}

// A diagram takes no links (Mermaid's `click ... href`): inside role="img" a
// link is out of screen readers' reach, and its keyboard stop lands in the
// aria-hidden SVG. Judged from Pele's output, never the source: a source-text
// scan for "click" also matches prose (an accDescr sentence, a label, a
// journey task) that renders no link at all. Pele reports every link it drew
// in `links`, and draws a link as an <a>, so either signal is reliable. It
// ignores a callback-only `click` and a sequence `link`, which leave nothing
// in the figure to guard.
const RENDERED_SVG_LINK = /<a[\s/>]/;

/**
 * Renders Mermaid source to the MermaidDiagram figure at build, in process.
 * Pele draws the SVG itself, so no browser is involved.
 */
export function renderMermaidFigure(source: string): string {
	// Unique per diagram, so two diagrams on a page don't share ids.
	const prefix = `mermaid-${createHash("sha256").update(source).digest("hex").slice(0, 8)}`;
	let result: RenderResult;
	try {
		result = render(source, {
			idPrefix: prefix,
			// A wide diagram scrolls in its frame; it doesn't shrink to the column.
			responsive: false,
			autoDirection: false,
			fontSize: FONT_SIZE,
			fontFamily: MONO_STACK,
			fontFamilyMono: MONO_STACK,
			measurer: jetbrainsMono,
			// Keep links in the output so the guard below can see them.
			links: true,
			// A static page makes no image requests.
			images: false,
		});
	} catch (error) {
		// Only a PeleError is an authoring error. Anything else is a bug in Pele.
		if (error instanceof PeleError) {
			throw new Error(
				`Mermaid couldn't render this diagram: ${error.message}\n\n${source}`,
				{ cause: error },
			);
		}
		throw error;
	}

	const { svg, links } = result;
	if (links.length > 0 || RENDERED_SVG_LINK.test(svg)) {
		throw new Error(
			`A Mermaid diagram is one image; it can't carry its own link (\`click\`). Link from the caption or the text around the diagram instead:\n${source}`,
		);
	}
	const label = [
		accessibleText(svg, prefix, "title"),
		accessibleText(svg, prefix, "desc"),
	]
		.filter(Boolean)
		.join(": ");
	if (label === "") {
		throw new Error(
			`Name this Mermaid diagram with accTitle or accDescr; they become its accessible name. Add them after the diagram type line, for example:\n\n  accTitle: Checkout flow\n  accDescr: The product page hands off to checkout.\n\n${source}`,
		);
	}
	// Without `aria-hidden`, Chromium still exposes an image's SVG children:
	// the title and description a second time, and every label in pieces. The
	// figure's `aria-label` already carries them.
	return `<figure data-diagram role="img" tabindex="0" aria-label="${escapeAttribute(label)}">${svg.replace("<svg", '<svg aria-hidden="true"')}</figure>`;
}
