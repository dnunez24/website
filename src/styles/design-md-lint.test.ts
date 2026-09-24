import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { lint } from "@google/design.md/linter";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..", "..");

/**
 * The design.md CLI exits 1 only when `errors > 0` (`broken-ref` is the one
 * error-level rule); every other rule, including `contrast-ratio` and
 * `section-order`, is a warning or info that the CLI happily ignores. That
 * means `design.md lint` can pass with a component pair that fails contrast
 * or sections in the wrong order — exactly the regressions the linter exists
 * to catch. Lint here instead, through the programmatic API, and fail the
 * build on anything outside this explicit allowlist.
 *
 * - orphaned-tokens: palette reserve steps, the focus ring, hairlines, and
 *   chart series colors have no single component to reference them from.
 *   Accepted, not deleted: DESIGN.md's "no invented tokens" rule means every
 *   value in tokens.json stays, whether or not a component cites it.
 * - missing-primary: the design system's primary role is named `color-brand`,
 *   not `primary` (see the Colors table). Adding an unused `primary` alias
 *   would invent a token with no real user and risk an agent writing
 *   `var(--color-primary)`, which `--color-*: initial` guarantees doesn't
 *   exist.
 * - token-summary: an info-level token count. Never actionable.
 */
const ACCEPTED_RULES = new Set([
	"orphaned-tokens",
	"missing-primary",
	"token-summary",
]);

describe("DESIGN.md lint (design.md)", () => {
	it("has no findings outside the accepted-rules allowlist", async () => {
		const source = await readFile(resolve(ROOT, "DESIGN.md"), "utf8");
		const { findings } = lint(source);
		const unexpected = findings.filter(
			(f) => !ACCEPTED_RULES.has(f.rule ?? ""),
		);
		expect(unexpected).toEqual([]);
	});

	it("still catches a broken reference", async () => {
		const source = await readFile(resolve(ROOT, "DESIGN.md"), "utf8");
		const broken = source.replace(
			'color-brand: "{colors.color-evergreen-700}"',
			'color-brand: "{colors.color-evergreen-700-nonexistent}"',
		);
		expect(broken).not.toBe(source);
		const { findings } = lint(broken);
		expect(findings.some((f) => f.rule === "broken-ref")).toBe(true);
	});

	it("still catches a contrast regression", async () => {
		const source = await readFile(resolve(ROOT, "DESIGN.md"), "utf8");
		// evergreen-300 on evergreen-200 is a real pair from the palette, well under 4.5:1.
		const broken = source.replace(
			'button-filled: { typography: "{typography.label}", textColor: "{colors.color-on-brand}", backgroundColor: "{colors.color-brand}"',
			'button-filled: { typography: "{typography.label}", textColor: "{colors.color-evergreen-300}", backgroundColor: "{colors.color-evergreen-200}"',
		);
		expect(broken).not.toBe(source);
		const { findings } = lint(broken);
		expect(findings.some((f) => f.rule === "contrast-ratio")).toBe(true);
	});
});
