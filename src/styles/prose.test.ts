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

	it("gives the footnote reference brackets an empty accessible alternative, with a plain fallback first", async () => {
		const css = await compileGlobalCss();
		const ref = ruleBody(css, /&\s*a\[data-footnote-ref\]\s*\{/);
		const before = ruleBody(ref, /&::before\s*\{/);
		const after = ruleBody(ref, /&::after\s*\{/);
		// One assertion per side, order-sensitive: a browser without
		// alternative-text support discards that whole second declaration and
		// keeps the plain one regardless of where it sits, but a supporting
		// browser applies whichever declaration comes last. So the plain
		// string must be written first and the alternative-text form last, or
		// a supporting browser reads the reference as "[1]" again.
		expect(before).toMatch(
			/content:\s*"\[";\s*(\/\*[\s\S]*?\*\/\s*)?content:\s*"\["\s*\/\s*"";/,
		);
		expect(after).toMatch(
			/content:\s*"\]";\s*(\/\*[\s\S]*?\*\/\s*)?content:\s*"\]"\s*\/\s*"";/,
		);
	});

	it("doesn't transform the hidden footnotes heading to uppercase, so its accessible name stays sentence case", async () => {
		const css = await compileGlobalCss();
		const footnotes = ruleBody(css, /&\s*\.footnotes\s*\{/);
		const h2 = ruleBody(footnotes, /&\s*h2\s*\{/);
		expect(h2).not.toMatch(/text-transform/);
	});

	it("doesn't transition outline-color, so the focus ring shows at full color on the first frame", async () => {
		const css = await compileGlobalCss();
		const link = ruleBody(css, /&\s*a:not\(\[data-button\]\)\s*\{/);
		expect(link).toMatch(/transition-property:[^;]*color/);
		expect(link).not.toMatch(/transition-property:[^;]*outline-color/);

		const foldIcon = ruleBody(css, /&\s*\.callout-fold-icon\s*\{/);
		expect(foldIcon).toMatch(/transition-property:[^;]*color/);
		expect(foldIcon).not.toMatch(/transition-property:[^;]*outline-color/);
	});
});
