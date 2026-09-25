import { describe, expect, it } from "vitest";
import { compileGlobalCss, ruleBody } from "../test/classes";

/**
 * Forced-colors mode (Windows contrast themes) recolors backgrounds to
 * `Canvas` and flattens anything drawn only with a tint. These assert the
 * G1 audit's m4-m8 fixes compile with the right system-color keywords, in
 * both places a rule reaches the page (a literal utility class and an
 * `@apply` of the same utility inside `.prose`, where relevant).
 */
describe("forced colors (compiled)", () => {
	it("m7: gives Callout, CodeBlock and plain pre a transparent inset outline, at zero specificity, only under forced colors", async () => {
		const css = await compileGlobalCss();
		// Anchored on the @media wrapper, not just the :where() selector: the
		// whole rule must exist only under forced colors, not merely have the
		// right declarations wherever it happens to compile.
		const rule = ruleBody(
			css,
			/@media \(forced-colors: active\)\s*\{\s*:where\(\s*\.prose \[data-callout\],\s*\[data-codeblock\],\s*\.prose pre:not\(\[data-codeblock\] pre\)\s*\)\s*\{/,
		);
		expect(rule).toMatch(/outline:\s*1px solid transparent/);
		expect(rule).toMatch(/outline-offset:\s*-1px/);
	});

	it("m4: takes LinkText for the external-link mark, both as a class and via .prose's @apply", async () => {
		const css = await compileGlobalCss(["link-external"]);

		const direct = ruleBody(css, /\.link-external::after\s*\{/);
		const directForced = ruleBody(
			direct,
			/@media \(forced-colors: active\)\s*\{/,
		);
		expect(directForced).toMatch(/background-color:\s*LinkText/);

		const proseLink = ruleBody(
			css,
			/&\s*a\[href\^="http"\]:not\(\[data-button\]\)\s*\{/,
		);
		const proseAfter = ruleBody(proseLink, /&::after\s*\{/);
		const proseForced = ruleBody(
			proseAfter,
			/@media \(forced-colors: active\)\s*\{/,
		);
		expect(proseForced).toMatch(/background-color:\s*LinkText/);
	});

	it("m6: takes LinkText for a current ghost Button rendered as <a>, ButtonText for one rendered as <button>", async () => {
		const css = await compileGlobalCss();
		// Each selector is unique in the compiled output (declared nowhere
		// else), so finding either one at all means it compiled inside
		// forced-colors.css's @media (forced-colors: active) block - the only
		// place either is written.
		const aRule = ruleBody(
			css,
			/@media \(forced-colors: active\)\s*\{\s*a\[data-button\]:is\(\[aria-current="page"\],\s*\[aria-current="true"\]\)::after\s*\{/,
		);
		expect(aRule).toMatch(/background-color:\s*LinkText/);

		// Anchored on the <a> rule's own closing brace, so this also proves
		// the two sit together as siblings, not in separate rules that
		// happen to compile the same values.
		const buttonRule = ruleBody(
			css,
			/a\[data-button\]:is\(\[aria-current="page"\],\s*\[aria-current="true"\]\)::after\s*\{\s*background-color:\s*LinkText;\s*\}\s*button\[data-button\]:is\(\[aria-current="page"\],\s*\[aria-current="true"\]\)::after\s*\{/,
		);
		expect(buttonRule).toMatch(/background-color:\s*ButtonText/);
	});

	it("m5: fills the checked task checkbox with SelectedItem/CanvasText and draws the check in SelectedItemText", async () => {
		const css = await compileGlobalCss();
		const checkbox = ruleBody(
			css,
			/&\s*li\.task-list-item\s*>\s*input\[type="checkbox"\]\s*\{/,
		);

		const checked = ruleBody(checkbox, /&:checked\s*\{/);
		const checkedForced = ruleBody(
			checked,
			/@media \(forced-colors: active\)\s*\{/,
		);
		expect(checkedForced).toMatch(/background-color:\s*SelectedItem/);
		expect(checkedForced).toMatch(/border-color:\s*CanvasText/);

		const mark = ruleBody(checkbox, /&:checked::before\s*\{/);
		const markForced = ruleBody(mark, /@media \(forced-colors: active\)\s*\{/);
		expect(markForced).toMatch(/background-color:\s*SelectedItemText/);
	});

	it("m8: keeps Mermaid's own colors as one island, and takes CanvasText/Highlight for its frame and focus ring", async () => {
		const css = await compileGlobalCss();
		const frame = ruleBody(css, /\[data-diagram\]\s*\{/);
		expect(frame).toMatch(/forced-color-adjust:\s*none/);
		const frameForced = ruleBody(
			frame,
			/@media \(forced-colors: active\)\s*\{/,
		);
		expect(frameForced).toMatch(/border-color:\s*CanvasText/);

		// The compiler hoists a rule whose whole body is one @media block, so
		// this one compiles media-first instead of nested like the frame above.
		const focusForced = ruleBody(
			css,
			/@media \(forced-colors: active\)\s*\{\s*\[data-diagram\]:focus-visible\s*\{/,
		);
		expect(focusForced).toMatch(/outline-color:\s*Highlight/);
	});
});
