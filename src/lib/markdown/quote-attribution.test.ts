import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { callouts } from "./callouts";
import { quoteAttribution } from "./quote-attribution";

const render = (markdown: string) =>
	markdownToHtml(markdown, { hastPlugins: [quoteAttribution()] }).html;

describe("quoteAttribution", () => {
	it("turns a final em dash paragraph into the quote's footer", () => {
		const html = render(
			"> Less, but better.\n>\n> — Dieter Rams, <cite>Ten principles for good design</cite>\n",
		);
		expect(html).toContain("<p>Less, but better.</p>");
		expect(html).toContain(
			"<footer>Dieter Rams, <cite>Ten principles for good design</cite></footer>",
		);
		expect(html).not.toContain("—");
	});

	it("keeps inline Markdown and footnote references in the attribution", () => {
		const html = render(
			"> Quote.\n>\n> — _Rob Pike_[^1]\n\n[^1]: Gopherfest, 2015.\n",
		);
		expect(html).toMatch(/<footer><em>Rob Pike<\/em><sup>.*<\/sup><\/footer>/);
	});

	it("leaves a quote without an attribution line alone", () => {
		const html = render("> First paragraph.\n>\n> Second paragraph.\n");
		expect(html).not.toContain("<footer>");
		expect(html).toContain("<p>Second paragraph.</p>");
	});

	it("leaves a lone dash paragraph as the quote itself", () => {
		const html = render("> — A line that opens with a dash.\n");
		expect(html).not.toContain("<footer>");
		expect(html).toContain("<p>— A line that opens with a dash.</p>");
	});

	it("ignores a dash that doesn't open the last paragraph", () => {
		const html = render("> Quote — with an aside.\n>\n> Rob Pike\n");
		expect(html).not.toContain("<footer>");
	});

	it("still finds the attribution when the quote is nested in a callout", async () => {
		// satteri-callouts runs first (astro.config.ts), turning the outer
		// blockquote into a `[data-callout]` div before this plugin sees the
		// document, so only the inner blockquote is left to match `filter`.
		const { html } = await markdownToHtml(
			"> [!NOTE]\n> A quotation can appear inside a callout.\n>\n> > Less, but better.\n> >\n> > — Dieter Rams, <cite>Ten principles for good design</cite>\n",
			{ hastPlugins: [...callouts(), quoteAttribution()] },
		);
		expect(html).toContain('data-callout="note"');
		expect(html).toContain(
			"<footer>Dieter Rams, <cite>Ten principles for good design</cite></footer>",
		);
	});
});
