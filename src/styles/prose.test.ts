import { describe, expect, it } from "vitest";
import { compileGlobalCss, ruleBody } from "../test/classes";

describe("prose.css and components.css (compiled)", () => {
	it("raises a footnote reference once: static position, 0.3em vertical-align", async () => {
		const css = await compileGlobalCss();
		const body = ruleBody(
			css,
			/&\s*sup:has\(>\s*a\[data-footnote-ref\]\)\s*\{/,
		);
		expect(body).toMatch(/position:\s*static/);
		expect(body).toMatch(/vertical-align:\s*0\.3em/);
	});

	it("scopes quote links to the Fungus hue via --color-link, not a selector", async () => {
		const css = await compileGlobalCss();

		// Markdown quotes: `.prose blockquote`.
		const blockquote = ruleBody(css, /&\s*blockquote\s*\{/);
		expect(blockquote).toMatch(/--color-link:\s*var\(--color-quote-link\)/);
		expect(blockquote).toMatch(
			/--color-link-hover:\s*var\(--color-quote-link-hover\)/,
		);

		// BlockQuote.astro outside `.prose`: `[data-quote]`.
		const dataQuote = ruleBody(css, /\[data-quote\]\s*\{/);
		expect(dataQuote).toMatch(/--color-link:\s*var\(--color-quote-link\)/);
		expect(dataQuote).toMatch(
			/--color-link-hover:\s*var\(--color-quote-link-hover\)/,
		);
	});

	it("gives a nested quote's citation quote-ink inside a Callout via --color-quote-cite", async () => {
		const css = await compileGlobalCss();
		const callout = ruleBody(css, /&\s*\[data-callout\]\s*\{/);
		expect(callout).toMatch(/--color-quote-cite:\s*var\(--color-quote-ink\)/);
	});
});
