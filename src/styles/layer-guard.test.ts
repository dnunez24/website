import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { compileGlobalCss } from "../test/classes";

/**
 * Which cascade layer wins is not just a matter of selector specificity:
 * Tailwind ranks utilities above components above base, and that ranking
 * beats specificity regardless of how a selector is written (see
 * forced-colors.css and base.css's own comments). These fixes only work
 * because each sits in a specific layer relative to the rule it needs to
 * lose to (m7) or beat (m6). Nothing else asserts the layer itself, so a
 * well-meaning "consolidation" that moves one into the wrong place would
 * still pass every other compiled-CSS test. Names of the @layer blocks
 * enclosing `index`, outermost first ([] = unlayered).
 */
function layersAt(css: string, index: number): string[] {
	const stack: string[] = [];
	const opener = /@layer\s+([\w-]+)\s*\{|\{|\}/g;
	for (let m = opener.exec(css); m && m.index < index; m = opener.exec(css)) {
		if (m[0] === "}") stack.pop();
		else stack.push(m[1] ?? "");
	}
	return stack.filter(Boolean);
}

describe("G1c overrides sit in the layer that lets them win", () => {
	it("m6's rule is unlayered: after:bg-current lives in utilities", async () => {
		const css = await compileGlobalCss();
		const at = css.search(/\[data-button\]:is\(\[aria-current="page"\]/);
		expect(at).toBeGreaterThan(-1);
		expect(layersAt(css, at)).toEqual([]);
	});

	it("m7's transparent outline stays in base, below every focus ring", async () => {
		const css = await compileGlobalCss();
		const at = css.search(/:where\(\s*\.prose \[data-callout\]/);
		expect(at).toBeGreaterThan(-1);
		expect(layersAt(css, at)).toEqual(["base"]);
	});

	it("m6's button variant is unlayered too: button[data-button] lives beside the a[data-button] rule", async () => {
		const css = await compileGlobalCss();
		const at = css.search(/button\[data-button\]:is\(\[aria-current="page"\]/);
		expect(at).toBeGreaterThan(-1);
		expect(layersAt(css, at)).toEqual([]);
	});
});

/**
 * Astro's <Image> styles as the installed Astro generates them. Astro serves
 * them from a virtual module and doesn't export the generator, so this loads
 * its file directly: an upgrade that renames the `astro.images` layer then
 * fails here instead of slipping past a hand-copied rule.
 */
async function astroImageStyles(): Promise<string> {
	const astro = dirname(
		createRequire(import.meta.url).resolve("astro/package.json"),
	);
	const file = join(astro, "dist/assets/utils/generateImageStylesCSS.js");
	const { generateImageStylesCSS }: { generateImageStylesCSS: () => string } =
		await import(pathToFileURL(file).href);
	return generateImageStylesCSS();
}

// Chromium's cold start takes a few seconds, same as the Mermaid and a11y tests.
describe("astro.images ranks below utilities", { timeout: 60_000 }, () => {
	it("lets h-* and object-* on an <Image> beat Astro's height: auto and fit rules", async () => {
		// A built page's order: global.css first, Astro's styles after it.
		// Only global.css's own layer statement can keep utilities above
		// Astro's layer.
		const css =
			(await compileGlobalCss(["h-48", "object-contain"])) +
			(await astroImageStyles());
		const browser = await chromium.launch({ timeout: 60_000 });
		try {
			const page = await browser.newPage();
			await page.setContent(
				`<style>${css}</style><img data-astro-image="constrained" data-astro-image-fit="cover" width="960" height="480" class="h-48 object-contain" alt="">`,
			);
			const styles = await page.$eval("img", (img) => {
				const { height, objectFit } = getComputedStyle(img);
				return { height, objectFit };
			});
			expect(styles).toEqual({ height: "192px", objectFit: "contain" });
		} finally {
			await browser.close();
		}
	});
});
