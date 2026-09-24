import { Window } from "happy-dom";
import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { mermaidDiagrams } from "./markdown/mermaid";
import { renderMermaidFigure } from "./mermaid";

const { DOMParser } = new Window();
const parse = (html: string) =>
	new DOMParser().parseFromString(html, "text/html") as unknown as Document;

const flowchart = `flowchart LR
  accTitle: Checkout flow
  accDescr: The product page hands off to checkout.
  A[Product page] --> B[Checkout MFE]`;

// Rendering starts headless Chromium, which takes a few seconds cold.
describe("renderMermaidFigure", { timeout: 60_000 }, () => {
	it("renders a named, focusable figure at the diagram's rendered size", async () => {
		const figure = parse(await renderMermaidFigure(flowchart)).querySelector(
			"figure[data-diagram]",
		);
		expect(figure?.getAttribute("role")).toBe("img");
		expect(figure?.getAttribute("tabindex")).toBe("0");
		expect(figure?.getAttribute("aria-label")).toBe(
			"Checkout flow: The product page hands off to checkout.",
		);
		const svg = figure?.querySelector("svg");
		expect(Number(svg?.getAttribute("width"))).toBeGreaterThan(100);
		expect(Number(svg?.getAttribute("height"))).toBeGreaterThan(0);
		expect(svg?.getAttribute("style") ?? "").not.toContain("max-width");
		// The figure's aria-label already carries accTitle/accDescr; without
		// this, Chromium exposes the SVG's own title, description and labels
		// a second time.
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
	});

	it("gives different diagrams different ids", async () => {
		const [a, b] = await Promise.all([
			renderMermaidFigure(flowchart),
			renderMermaidFigure(flowchart.replace("Checkout MFE", "Cart")),
		]);
		const id = (html: string) => parse(html).querySelector("svg")?.id;
		expect(id(a)).toBeTruthy();
		expect(id(a)).not.toBe(id(b));
	});

	it("fails a diagram without accTitle or accDescr", async () => {
		await expect(
			renderMermaidFigure("flowchart LR\n  A --> B"),
		).rejects.toThrow(/accTitle or accDescr/);
	});

	it("fails invalid Mermaid", async () => {
		await expect(
			renderMermaidFigure("flowchart LR\n  accTitle: Broken\n  A -->"),
		).rejects.toThrow(/couldn't render/);
	});
});

describe("mermaid fences in Markdown", { timeout: 60_000 }, () => {
	it("become diagrams, and other code fences stay code", async () => {
		const { html } = await markdownToHtml(
			`\`\`\`mermaid\n${flowchart}\n\`\`\`\n\n\`\`\`ts\nconst a = 1;\n\`\`\`\n`,
			{ hastPlugins: [mermaidDiagrams()] },
		);
		// Strings, not a DOM: happy-dom nests whatever follows an inline SVG's
		// self-closing tags inside the SVG.
		expect(html).toMatch(/^<figure data-diagram[^>]*><svg /);
		expect(html).not.toContain("language-mermaid");
		expect(html).toContain('<pre><code class="language-ts">const a = 1;');
	});
});
