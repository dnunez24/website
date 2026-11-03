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

describe("renderMermaidFigure", () => {
	it("renders a named, focusable figure at the diagram's rendered size", () => {
		const figure = parse(renderMermaidFigure(flowchart)).querySelector(
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

	it("names the figure from accTitle alone", () => {
		const figure = parse(
			renderMermaidFigure("flowchart LR\n  accTitle: Two steps\n  A --> B"),
		).querySelector("figure");
		expect(figure?.getAttribute("aria-label")).toBe("Two steps");
	});

	// A journey's `title` and its actors' own <title> elements are not the
	// diagram's accessible name; the id-matched accTitle/accDescr is.
	it("takes the name from accDescr, not from a journey's own title text", () => {
		const figure = parse(
			renderMermaidFigure(
				"journey\n  title My journey\n  accDescr: A journey diagram.\n  section Shop\n    Browse: 5: Me",
			),
		).querySelector("figure");
		expect(figure?.getAttribute("aria-label")).toBe("A journey diagram.");
	});

	it("keeps quotes, angle brackets and ampersands in the label as written", () => {
		const title = `A "quoted" <b> & 'plain'`;
		const figure = parse(
			renderMermaidFigure(`flowchart LR\n  accTitle: ${title}\n  A --> B`),
		).querySelector("figure");
		expect(figure?.getAttribute("aria-label")).toBe(title);
	});

	it("gives different diagrams different ids, each labelled by its own title", () => {
		const a = renderMermaidFigure(flowchart);
		const b = renderMermaidFigure(flowchart.replace("Checkout MFE", "Cart"));
		const ids = (html: string) =>
			[...html.matchAll(/\sid="([^"]+)"/g)].flatMap((match) => match[1] ?? []);
		expect(ids(a).length).toBeGreaterThan(0);
		expect(ids(a).filter((id) => ids(b).includes(id))).toEqual([]);
		for (const html of [a, b]) {
			const [titleId] = ids(html).filter((id) => id.endsWith("-title"));
			expect(html).toContain(`aria-labelledby="${titleId}`);
		}
	});

	it("renders the same source to the same bytes", () => {
		expect(renderMermaidFigure(flowchart)).toBe(renderMermaidFigure(flowchart));
	});

	// JetBrains Mono's glyphs share one advance. Pele's own table is
	// proportional, which would make "WWWW" wider than "iiii".
	it("sizes boxes for monospace text: equal-length labels, equal widths", () => {
		const html = renderMermaidFigure(
			"flowchart LR\n  accTitle: Widths\n  A[iiii] --> B[WWWW]",
		);
		const widths = [...html.matchAll(/<rect [^>]*\swidth="([\d.]+)"/g)].map(
			(match) => match[1],
		);
		expect(widths).toHaveLength(2);
		expect(widths[0]).toBe(widths[1]);
	});

	describe("without a name", () => {
		const message = () => {
			try {
				renderMermaidFigure("flowchart LR\n  A --> B");
			} catch (error) {
				return (error as Error).message;
			}
			return "";
		};

		it("fails a diagram without accTitle or accDescr", () => {
			expect(message()).toMatch(/accTitle or accDescr/);
		});

		it("shows both keywords in an example, then the source", () => {
			expect(message()).toMatch(/^ {2}accTitle: /m);
			expect(message()).toMatch(/^ {2}accDescr: /m);
			expect(message().endsWith("flowchart LR\n  A --> B")).toBe(true);
		});
	});

	describe("with invalid Mermaid", () => {
		const message = (source: string) => {
			try {
				renderMermaidFigure(source);
			} catch (error) {
				return (error as Error).message;
			}
			return "";
		};

		it("fails with the line, the failing line, a marker and the source", () => {
			const source = "flowchart LR\n  accTitle: Broken\n  A -->";
			const text = message(source);
			expect(text).toMatch(/couldn't render/);
			expect(text).toContain("line 3");
			expect(text).toMatch(/^ {2}A -->\n-+\^$/m);
			expect(text.endsWith(source)).toBe(true);
		});

		it("points at a misspelled keyword", () => {
			const text = message(
				"flowchart LR\n  accTitle: Typo\n  accDescription: Hi\n  A --> B",
			);
			expect(text).toContain("line 3");
			expect(text).toContain("  accDescription: Hi");
		});

		it("counts frontmatter lines", () => {
			expect(
				message("---\ntitle: Checkout\n---\nflowchart LR\n  A -->"),
			).toContain("line 5");
		});

		it("says when no diagram type is detected", () => {
			const text = message("nonsense\n  A");
			expect(text).toMatch(/couldn't render/);
			expect(text).toContain("No diagram type detected");
		});
	});

	it("fails a diagram with a click href link: the figure is one image, not a link", () => {
		expect(() =>
			renderMermaidFigure(
				'flowchart LR\n  accTitle: Linked\n  accDescr: A node links out.\n  A[Product page] --> B[Docs]\n  click B href "https://example.com/docs"',
			),
		).toThrow(/can't carry its own link/);
	});

	// Pele draws no link for these, so nothing in the figure needs a guard.
	it("renders a callback click as a figure with no <a>", () => {
		const html = renderMermaidFigure(
			"flowchart LR\n  accTitle: Callback\n  accDescr: A node calls back.\n  A[Product page] --> B[Docs]\n  click B call myCallback()",
		);
		expect(html).toContain("<figure");
		expect(html).not.toMatch(/<a[\s/>]/);
	});

	it("renders a sequence diagram's participant link as a figure with no <a>", () => {
		const html = renderMermaidFigure(
			"sequenceDiagram\n  accTitle: Handoff\n  accDescr: A note.\n  participant Buyer\n  participant Docs\n  link Buyer: Docs @ https://example.com/docs\n  Buyer->>Docs: Ask",
		);
		expect(html).toContain("<figure");
		expect(html).not.toMatch(/<a[\s/>]/);
	});

	// The old check scanned the source for a line starting with "click", which
	// also matched prose that has nothing to do with Mermaid's click syntax.
	// These render with no link, so they must not be rejected. Each source line
	// genuinely starts with "click" (after only whitespace), the exact shape
	// the old regex matched.
	it('renders a diagram whose accDescr block has a line starting with "click"', () => {
		const html = renderMermaidFigure(
			"flowchart LR\n  accTitle: Shopping\n  accDescr {\n    Buy leads to docs.\n    click Buy, then see the docs.\n  }\n  A[Buy] --> B[Docs]",
		);
		expect(html).toContain("<figure");
	});

	it('renders a diagram whose markdown-string label has a second line starting with "click"', () => {
		const html = renderMermaidFigure(
			'flowchart LR\n  accTitle: Shopping\n  accDescr: A label with instructions.\n  A["`Buy now\nclick to continue`"] --> B[Docs]',
		);
		expect(html).toContain("<figure");
	});

	it('renders a journey diagram whose task text starts with "click"', () => {
		const html = renderMermaidFigure(
			"journey\n  title My journey\n  accDescr: A journey diagram.\n  section Shop\n    click product: 5: Me",
		);
		expect(html).toContain("<figure");
	});
});

describe("mermaid fences in Markdown", () => {
	it("become diagrams, and other code fences stay code", () => {
		const { html } = markdownToHtml(
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
