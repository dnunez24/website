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

	it("fails a diagram with a click href link: the figure is one image, not a link", async () => {
		await expect(
			renderMermaidFigure(
				'flowchart LR\n  accTitle: Linked\n  accDescr: A node links out.\n  A[Product page] --> B[Docs]\n  click B href "https://example.com/docs"',
			),
		).rejects.toThrow(/can't carry its own link/);
	});

	it("fails a diagram with a click callback: Mermaid marks it clickable even with no href", async () => {
		await expect(
			renderMermaidFigure(
				"flowchart LR\n  accTitle: Callback\n  accDescr: A node calls back.\n  A[Product page] --> B[Docs]\n  click B call myCallback()",
			),
		).rejects.toThrow(/can't carry its own link/);
	});

	// The old check scanned the source for a line starting with "click", which
	// also matched prose that has nothing to do with Mermaid's click syntax.
	// Mermaid renders each of these with no <a> and no "clickable" class, so
	// they must not be rejected. Each source line genuinely starts with
	// "click" (after only whitespace), the exact shape the old regex matched.
	it('renders a diagram whose accDescr block has a line starting with "click"', async () => {
		const html = await renderMermaidFigure(
			"flowchart LR\n  accTitle: Shopping\n  accDescr {\n    Buy leads to docs.\n    click Buy, then see the docs.\n  }\n  A[Buy] --> B[Docs]",
		);
		expect(html).toContain("<figure");
	});

	it('renders a diagram whose markdown-string label has a second line starting with "click"', async () => {
		const html = await renderMermaidFigure(
			'flowchart LR\n  accTitle: Shopping\n  accDescr: A label with instructions.\n  A["`Buy now\nclick to continue`"] --> B[Docs]',
		);
		expect(html).toContain("<figure");
	});

	it('renders a journey diagram whose task text starts with "click"', async () => {
		const html = await renderMermaidFigure(
			"journey\n  title My journey\n  accDescr: A journey diagram.\n  section Shop\n    click product: 5: Me",
		);
		expect(html).toContain("<figure");
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
