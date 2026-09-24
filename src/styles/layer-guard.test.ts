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
});

describe("footnote reference brackets", () => {
	it("render the plain string first, the alternative text last", async () => {
		const css = await compileGlobalCss();
		// A reversed order would still contain both declarations; only their
		// sequence tells a fallback-first pair from a fallback-last one.
		expect(css).toMatch(
			/content:\s*"\[";\s*(\/\*[\s\S]*?\*\/\s*)?content:\s*"\["\s*\/\s*"";/,
		);
		expect(css).toMatch(
			/content:\s*"\]";\s*(\/\*[\s\S]*?\*\/\s*)?content:\s*"\]"\s*\/\s*"";/,
		);
	});
});
