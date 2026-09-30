import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import BlockQuote from "../components/BlockQuote.astro";
import Link from "../components/Link.astro";
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

	it("hides the footnotes heading itself, not via a generated `.sr-only`, and keeps it in the accessibility tree", async () => {
		// No candidates: `.sr-only` isn't generated, so only the footnotes
		// rule can hide the heading.
		const css = await compileGlobalCss();
		const footnotes = ruleBody(css, /&\s*\.footnotes\s*\{/);
		const h2 = ruleBody(footnotes, /&\s*h2\s*\{/);
		expect(h2).toMatch(/position:\s*absolute/);
		expect(h2).toMatch(/clip-path:\s*inset\(50%\)/);
		expect(h2).toMatch(/width:\s*1px/);
		expect(h2).not.toMatch(/display:\s*none|visibility:\s*hidden/);
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

/*
 * Layer order, specificity and custom-property inheritance all decide these
 * colors, so they're read from a real cascade, not the compiled text. Plain
 * `<a>` and `<blockquote>` stand in for Markdown output.
 */
describe("links in a Callout (Chromium)", { timeout: 60_000 }, () => {
	it("stay ink from Markdown or the Link component, quoted or not", async () => {
		const container = await AstroContainer.create();
		const md = (href: string) => `<a href="${href}">link</a>`;
		const link = (href: string) =>
			container.renderToString(Link, {
				props: { href },
				slots: { default: "link" },
			});
		const quote = async (href: string) =>
			container.renderToString(BlockQuote, {
				props: { author: "Author" },
				slots: { default: `<p>${await link(href)}</p>` },
			});
		const html = `<div class="prose">
			<p>${md("#md")} ${await link("#link")}</p>
			<blockquote><p>${md("#quote-md")} ${await link("#quote-link")}</p></blockquote>
			${await quote("#blockquote-link")}
			<div class="callout" data-callout="note"><div class="callout-content">
				<p>${md("#callout-md")} ${await link("#callout-link")}</p>
				<blockquote><p>${md("#callout-quote-md")} ${await link("#callout-quote-link")}</p></blockquote>
				${await quote("#callout-blockquote-link")}
			</div></div>
		</div>`;
		const css = await compileGlobalCss(
			[...html.matchAll(/class="([^"]*)"/g)].flatMap(([, names = ""]) =>
				names.split(/\s+/),
			),
		);

		const browser = await chromium.launch();
		try {
			const page = await browser.newPage();
			// A color read mid-transition would match neither state.
			await page.setContent(
				`<style>${css}*{transition:none!important}</style>${html}`,
			);
			const tokenByColor = new Map(
				await page.evaluate(
					(tokens) =>
						tokens.map((token) => {
							const probe = document.createElement("i");
							probe.style.color = `var(--color-${token})`;
							document.body.append(probe);
							return [getComputedStyle(probe).color, token] as const;
						}),
					["ink", "link", "link-hover", "quote-link", "quote-link-hover"],
				),
			);
			/** The link's token at rest, then hovered. */
			const tokensOf = async (href: string) => {
				const selector = `a[href="${href}"]`;
				const read = async () => {
					const color = await page.$eval(
						selector,
						(a) => getComputedStyle(a).color,
					);
					return tokenByColor.get(color) ?? color;
				};
				const rest = await read();
				await page.hover(selector);
				return [rest, await read()];
			};

			// Outside a Callout: the page and quote hues, so the Callout's scope doesn't leak.
			for (const [href, token] of [
				["#md", "link"],
				["#link", "link"],
				["#quote-md", "quote-link"],
				["#quote-link", "quote-link"],
				["#blockquote-link", "quote-link"],
			] as const) {
				expect
					.soft(await tokensOf(href), href)
					.toEqual([token, `${token}-hover`]);
			}
			for (const href of [
				"#callout-md",
				"#callout-link",
				"#callout-quote-md",
				"#callout-quote-link",
				"#callout-blockquote-link",
			]) {
				expect.soft(await tokensOf(href), href).toEqual(["ink", "ink"]);
			}
		} finally {
			await browser.close();
		}
	});
});
