import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDesignSystem, ROOT } from "../test/classes";

type DesignSystem = Awaited<ReturnType<typeof loadDesignSystem>>;

/**
 * SCOPE, read this before adding a test here.
 *
 * Full compile-checking below (does this class exist, is it arbitrary, is
 * its spacing step real) covers only three places: Layout & Spacing,
 * Elevation & Depth, and the Building table's utility column. Those are
 * where this design system's own Tailwind-utility guidance concentrates,
 * and where B1 and R3's regressions actually landed.
 *
 * It does NOT cover Overview, Colors, Typography, Shapes, Components,
 * Do's and Don'ts, Motion, Iconography or Accessibility. An invented class
 * dropped into one of those, such as `text-fungus-950` in Components,
 * `shadow-card` in Do's and Don'ts, or `sr-only-focusable` in Accessibility,
 * compiles or fails silently: nothing here checks it.
 *
 * Widening full compile-checking to the whole document was tried and
 * dropped. After excluding every frontmatter token name, HTML tag, ARIA
 * attribute, file path, CSS custom property and symbol-only fragment by
 * structural rule, 86 backticked spans in the current file still weren't
 * classes (CSS keywords and functions like `oklch`/`cubic-bezier(0.25,`,
 * OpenType feature tags, typeface-family words, component-name shorthands
 * like `-tip`, GitHub alert syntax, formula pieces...) and would need
 * denylisting one by one. That's not a short, honest allowlist; it's most
 * of the document. The two whole-document tests near the bottom of this
 * file are the narrower check that stayed: they scan every section for the
 * specific arbitrary-value syntax (`-(--`, `-[`) that caused both real
 * regressions, and pin the Building table's key mappings, without
 * asserting every backticked span anywhere is a valid, compilable class.
 */

/** Markdown sections where DESIGN.md tells an agent which class to write for a token, fully compile-checked below. */
const SECTIONS_TEACHING_CLASSES = ["Layout & Spacing", "Elevation & Depth"];

/**
 * Backticked spans in those sections, and in the Building table's utility
 * column, that are design-system token names, bare Tailwind scale numbers,
 * CSS properties, formulas or file/package names, not classes on their own
 * — real words that happen to look class-shaped once backticked. Denied
 * explicitly, with a reason, rather than guessed at: anything backticked in
 * scope that ISN'T here is asserted to compile, so an invented class has
 * nowhere to hide. Keep this list short; add to DESIGN.md's prose instead
 * of here when a new token needs explaining.
 */
const NOT_A_CLASS: Record<string, string> = {
	"2^n": "a formula, not a class",
	"1.5": "a formula's factor, not a class",
	"×": "a formula's operator, not a class",
	"0.5": "Tailwind's bare scale number, named beside its real class (p-0.5)",
	"1": "Tailwind's bare scale number, named beside its real class (gap-1)",
	"space-1": "a design-system token name",
	"space-2": "a design-system token name",
	"space-3": "a design-system token name",
	"space-4": "a design-system token name",
	"space-5": "a design-system token name",
	"space-6": "a design-system token name",
	"space-7": "a design-system token name",
	"-min": "a token-name suffix, not a class",
	"-max": "a token-name suffix, not a class",
	"fluidity-tailwind": "an npm package name",
	"f6y-*": "the utility family name, incomplete without its number suffix",
	p: "a bare property root, incomplete without a value",
	m: "a bare property root, incomplete without a value",
	gap: "a bare property root, incomplete without a value",
	"conformance.test.ts": "a file name",
	"container-site": "a design-system token name",
	"container-prose": "a design-system token name",
	"container-portrait": "a design-system token name",
	"max-w-prose": "named only as the utility this system does NOT use",
	"margin-inline": "a CSS property, not a Tailwind class",
	"margin-inline:": "a CSS property, not a Tailwind class",
	"margin-block": "a CSS property, not a Tailwind class",
	margin: "a CSS property, not a Tailwind class",
	"stroke-hairline": "a design-system token name",
	"stroke-rule": "a design-system token name",
	"stroke-focus": "a design-system token name",
	"stroke-focus-offset": "a design-system token name",
	"-focus-offset": "a token-name suffix, not a class",
	"duration-*": "a design-system token-name family, not a class",
	"color-line": "a color token, not a Tailwind class",
	"color-surface-inset": "a color token, not a Tailwind class",
	prose: "a typography token name",
	main: "the <main> element, not a class",
	auto: "part of a CSS declaration example, not a class",
};

/**
 * Every `` `span` `` in a string, with a multi-token span (like
 * `` `*:mx-auto *:max-w-measure` ``, two classes DESIGN.md names together)
 * split into its individual whitespace-separated tokens.
 */
function backtickSpans(text: string): string[] {
	return [...text.matchAll(/`([^`]+)`/g)].flatMap(([, span = ""]) =>
		span.split(/\s+/),
	);
}

/** Isolates a `## Heading` section's body, up to the next `## ` heading (or end of file). */
function section(source: string, heading: string): string {
	const re = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
	const body = re.exec(source)?.[1];
	if (body === undefined)
		throw new Error(`DESIGN.md has no "## ${heading}" section`);
	return body;
}

/** The Building section's table, one row per line, utility column (2nd) only. */
function buildingTableUtilities(source: string): string[] {
	const rows = [
		...section(source, "Building").matchAll(/^\s*\|(.+)\|(.+)\|\s*$/gm),
	];
	return rows
		.map(([, , utilityColumn = ""]) => utilityColumn)
		.filter((col) => !/^\s*-+\s*$/.test(col) && !/^\s*Utility\b/.test(col))
		.flatMap(backtickSpans);
}

/**
 * Expands DESIGN.md's own `*` wildcard root placeholder (used as `*-line`,
 * never followed by `:`) to a representative property root, the same
 * substitution DESIGN.md's own prose makes when it names one concrete
 * instance beside it (e.g. `mt-line` for `*-line`). Tailwind's own `*:`
 * child-selector variant (`*:mx-auto`) is a real, literal class already and
 * is left untouched, since a following `:` marks it as that variant, not
 * this placeholder. A bare `variant:` prefix gets a compilable candidate
 * appended. Everything else passes through unchanged.
 */
function normalize(token: string): string {
	if (/\*(?!:)/.test(token)) return token.replace(/\*(?!:)/g, "p");
	if (token.endsWith(":")) return `${token}flex`;
	return token;
}

/** Every class-like backtick span DESIGN.md's Building/Layout guidance tells an agent to write. */
function extractClasses(source: string): string[] {
	const fromProse = SECTIONS_TEACHING_CLASSES.flatMap((heading) =>
		backtickSpans(section(source, heading)),
	);
	const fromTable = buildingTableUtilities(source);
	const candidates = [...fromProse, ...fromTable].filter(
		(token) => !Object.hasOwn(NOT_A_CLASS, token),
	);
	return [...new Set(candidates.map(normalize))];
}

describe("DESIGN.md's Building and Layout guidance matches main's real utilities", () => {
	let system: DesignSystem;
	let designMdSource: string;
	let classes: string[];

	beforeAll(async () => {
		system = await loadDesignSystem();
		designMdSource = await readFile(resolve(ROOT, "DESIGN.md"), "utf8");
		classes = extractClasses(designMdSource);
	});

	it("extracts a healthy number of classes from DESIGN.md itself", () => {
		expect(classes.length).toBeGreaterThan(15);
	});

	it("every class taught in Layout & Spacing, Elevation & Depth or the Building table compiles", () => {
		const unknown = classes.filter(
			(name) => system.candidatesToCss([name])[0] === null,
		);
		expect(unknown).toEqual([]);
	});

	it("those same classes use no arbitrary values, the same ban conformance.test.ts enforces", () => {
		const arbitrary = classes.filter((name) =>
			system.parseCandidate(name).some((candidate) => {
				if (candidate.kind === "arbitrary") return true;
				if (candidate.kind === "functional") {
					if (candidate.value?.kind === "arbitrary") return true;
					if (candidate.modifier?.kind === "arbitrary") return true;
				}
				return candidate.variants.some((v) => v.kind === "arbitrary");
			}),
		);
		expect(arbitrary).toEqual([]);
	});

	it("fails on an invented class in a scanned section, by mutation", () => {
		// max-w-reading names no real container size in this or any Tailwind
		// design system; it must fail to compile, not just fail to be listed.
		const mutated = designMdSource.replace(
			"the `max-w-measure` utility",
			"the `max-w-measure` utility, never `max-w-reading`,",
		);
		expect(mutated).not.toBe(designMdSource);

		const mutatedClasses = extractClasses(mutated);
		expect(mutatedClasses).toContain("max-w-reading");

		const unknown = mutatedClasses.filter(
			(name) => system.candidatesToCss([name])[0] === null,
		);
		expect(unknown).toContain("max-w-reading");
	});

	// A class like f6y-p-3 compiles fine (fluidity-tailwind accepts any
	// number) but names no step this design system actually has: 3 sits
	// between the sanctioned space-3 (f6y-p-2) and space-4 (f6y-p-4). The
	// compile check above can't see that; this mirrors conformance.test.ts's
	// own spacing-step allowlist instead.
	const STATIC_SPACING = new Set([
		"auto",
		"0",
		"0.5",
		"1",
		"line",
		"line-half",
		"line-quarter",
		"line-double",
	]);
	const FLUID_SPACING = new Set(["2", "4", "8", "16", "32"]);
	const SPACING_ROOT =
		/^-?(p|px|py|ps|pe|pt|pr|pb|pl|m|mx|my|ms|me|mt|mr|mb|ml|gap|gap-x|gap-y)$/;
	const FLUID_SPACING_ROOT =
		/^f6y-(p|px|py|ps|pe|pt|pr|pb|pl|m|mx|my|ms|me|mt|mr|mb|ml|gap|gap-x|gap-y)$/;

	it("those same classes use only real design-system spacing steps, the same check conformance.test.ts makes", () => {
		const badSteps = classes.flatMap((name) =>
			system
				.parseCandidate(name)
				.filter((candidate) => candidate.kind === "functional")
				.flatMap((candidate) => {
					const value =
						candidate.value?.kind === "named"
							? candidate.value.value
							: undefined;
					if (value === undefined) return [];
					if (SPACING_ROOT.test(candidate.root) && !STATIC_SPACING.has(value)) {
						return [`${name}: spacing ${value} is not a design system step`];
					}
					if (
						FLUID_SPACING_ROOT.test(candidate.root) &&
						!FLUID_SPACING.has(value)
					) {
						return [
							`${name}: fluid spacing ${value} is not a design system step`,
						];
					}
					return [];
				}),
		);
		expect(badSteps).toEqual([]);
	});

	it("fails on an unsanctioned fluid step in a scanned section, by mutation", () => {
		const mutated = designMdSource.replace(
			"`f6y-p-8` is `space-5`",
			"`f6y-p-8` is `space-5`, `f6y-p-3` is nothing",
		);
		expect(mutated).not.toBe(designMdSource);

		const mutatedClasses = extractClasses(mutated);
		expect(mutatedClasses).toContain("f6y-p-3");

		const badSteps = mutatedClasses.flatMap((name) =>
			system
				.parseCandidate(name)
				.filter((candidate) => candidate.kind === "functional")
				.flatMap((candidate) => {
					const value =
						candidate.value?.kind === "named"
							? candidate.value.value
							: undefined;
					return value !== undefined &&
						FLUID_SPACING_ROOT.test(candidate.root) &&
						!FLUID_SPACING.has(value)
						? [name]
						: [];
				}),
		);
		expect(badSteps).toContain("f6y-p-3");
	});

	// Unlike the checks above (see the SCOPE note at the top of this file),
	// these two scan the whole document body, not specific sections: they
	// exist because B1's original `p-(--space-4)` text, or a regeneration
	// replacing the whole Building table, could otherwise land anywhere and
	// go unnoticed. They catch that one syntactic shape everywhere, not
	// every invented class everywhere (see the SCOPE note).
	it("teaches no arbitrary-value class anywhere in DESIGN.md", () => {
		const body = designMdSource.slice(designMdSource.indexOf("\n---\n", 4));
		const arbitrary = backtickSpans(body).filter((token) =>
			/-\(--|-\[/.test(token),
		);
		expect(arbitrary).toEqual([]);
	});

	it("keeps the Building table's key mappings", () => {
		expect(buildingTableUtilities(designMdSource)).toEqual(
			expect.arrayContaining([
				"max-w-measure",
				"f6y-p-2",
				"duration-128",
				"after:h-0.5",
			]),
		);
	});

	it("fails on a reintroduced arbitrary-value class, by mutation", () => {
		// p-(--space-4) is B1's original, since-corrected Building text: an
		// arbitrary value referencing a custom property main doesn't define.
		const mutated = designMdSource.replace(
			"- Astro static site, Tailwind CSS 4, no client JavaScript.",
			"- Set `p-(--space-4)` for this token. Astro static site, Tailwind CSS 4, no client JavaScript.",
		);
		expect(mutated).not.toBe(designMdSource);

		const body = mutated.slice(mutated.indexOf("\n---\n", 4));
		const arbitrary = backtickSpans(body).filter((token) =>
			/-\(--|-\[/.test(token),
		);
		expect(arbitrary).toContain("p-(--space-4)");
	});
});
