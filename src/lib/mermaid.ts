import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMermaidRenderer } from "mermaid-isomorphic";

/**
 * The design system's MermaidDiagram config. Colors are the tokens' hex
 * values; components.css re-applies the tokens over Mermaid's styles.
 * Margins are 1px, enough for edge strokes: the frame's padding does the
 * spacing, and Mermaid's own margins pushed diagrams that fit into scrolling.
 * Sequence diagrams size their text from the top-level `fontSize`, not the
 * theme's, so it's set to 13 as well.
 */
const mermaidConfig = {
	theme: "base",
	htmlLabels: false,
	fontSize: 13,
	flowchart: { htmlLabels: false, diagramPadding: 1 },
	sequence: { diagramMarginX: 1, diagramMarginY: 1 },
	fontFamily: "JetBrains Mono, ui-monospace, monospace",
	themeVariables: {
		primaryColor: "#ededec",
		primaryBorderColor: "#495944",
		primaryTextColor: "#252524",
		lineColor: "#585855",
		secondaryColor: "#dcdcd0",
		tertiaryColor: "#fcfcfb",
		background: "#fcfcfb",
		mainBkg: "#ededec",
		nodeBorder: "#495944",
		clusterBkg: "#fcfcfb",
		edgeLabelBackground: "#fcfcfb",
		textColor: "#252524",
		fontSize: "13px",
		fontFamily: "JetBrains Mono, ui-monospace, monospace",
	},
} as const;

let renderer: ReturnType<typeof createMermaidRenderer> | undefined;
let fontStylesheet: string | undefined;

/**
 * JetBrains Mono for the headless browser, so Mermaid sizes boxes to the
 * font the page shows. Read from the project root: builds and tests run there,
 * and this module's own URL moves once Vite bundles it.
 */
function fonts(): string {
	fontStylesheet ??= (() => {
		const font = readFileSync(
			join(
				process.cwd(),
				"src/assets/fonts/jetbrains-mono-latin-wght-normal.woff2",
			),
		).toString("base64");
		const css = `@font-face { font-family: "JetBrains Mono"; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 400 700; }`;
		return `data:text/css;base64,${Buffer.from(css).toString("base64")}`;
	})();
	return fontStylesheet;
}

const escapeAttribute = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;");

/**
 * Pins the SVG to its rendered size. Mermaid emits `width="100%"` with a
 * `max-width`, which scales a wide diagram down until its labels are
 * unreadable; the frame scrolls instead.
 */
function atRenderedSize(svg: string, width: number, height: number): string {
	return svg.replace(/^<svg\b[^>]*>/, (tag) =>
		tag
			.replace(/\s(?:width|height)="[^"]*"/g, "")
			.replace(/\sstyle="max-width:[^"]*"/, "")
			.replace(
				"<svg",
				`<svg width="${Math.ceil(width)}" height="${Math.ceil(height)}"`,
			),
	);
}

/**
 * Renders Mermaid source to the MermaidDiagram figure at build, in headless
 * Chromium. The browser starts on the first diagram and closes when idle, so
 * pages without diagrams never launch it.
 */
export async function renderMermaidFigure(source: string): Promise<string> {
	// Unique per diagram, so two diagrams on a page don't share ids or styles.
	const prefix = `mermaid-${createHash("sha256").update(source).digest("hex").slice(0, 8)}`;
	renderer ??= createMermaidRenderer();
	let result: Awaited<ReturnType<typeof renderer>>[number] | undefined;
	try {
		[result] = await renderer([source], {
			css: fonts(),
			mermaidConfig,
			prefix,
		});
	} catch (error) {
		throw new Error(
			"Mermaid renders in headless Chromium. Install it with `pnpm diagrams:browser`.",
			{ cause: error },
		);
	}
	if (result === undefined || result.status === "rejected") {
		throw new Error(`Mermaid couldn't render this diagram:\n${source}`, {
			cause: result?.reason,
		});
	}

	const { svg, width, height, title, description } = result.value;
	const label = [title, description].filter(Boolean).join(": ");
	if (label === "") {
		throw new Error(
			`Name this Mermaid diagram with accTitle or accDescr; they become its accessible name:\n${source}`,
		);
	}
	return `<figure data-diagram role="img" tabindex="0" aria-label="${escapeAttribute(label)}">${atRenderedSize(svg, width, height)}</figure>`;
}
