import { glob, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
	compileGlobalCss,
	extractApplyClasses,
	extractAstroClasses,
	loadDesignSystem,
	ROOT,
} from "../test/classes";

type DesignSystem = Awaited<ReturnType<typeof loadDesignSystem>>;
type Candidate = ReturnType<DesignSystem["parseCandidate"]>[number];

/** Fixed spacing steps: space-1 (0.5 = 2px), space-2 (1 = 4px), plus `auto` and prose-line keys. */
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
/** Fluid steps with --f6y-ratio 1.5: space-3 … space-7. */
const FLUID_SPACING = new Set(["2", "4", "8", "16", "32"]);
const SPACING_ROOT =
	/^-?(p|px|py|ps|pe|pt|pr|pb|pl|m|mx|my|ms|me|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|start|end|top|right|bottom|left)$/;
const FLUID_SPACING_ROOT =
	/^(f6y-(p|px|py|ps|pe|pt|pr|pb|pl|m|mx|my|ms|me|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|start|end|top|right|bottom|left)|bleed-[xseb])$/;

/**
 * Classes that are hooks, not utilities: Tailwind's `group` and `peer`
 * markers and the `.prose` component class.
 */
const MARKER_CLASSES = new Set(["group", "peer", "prose"]);

let system: DesignSystem;
const sources = new Map<string, string[]>();

beforeAll(async () => {
	system = await loadDesignSystem();
	for await (const file of glob("src/**/*.astro", { cwd: ROOT })) {
		sources.set(
			file,
			extractAstroClasses(await readFile(join(ROOT, file), "utf8")),
		);
	}
	for await (const file of glob("src/styles/*.css", { cwd: ROOT })) {
		sources.set(
			file,
			extractApplyClasses(await readFile(join(ROOT, file), "utf8")),
		);
	}
});

function* classesWithFiles() {
	for (const [file, classes] of sources) {
		for (const name of new Set(classes)) {
			if (!MARKER_CLASSES.has(name)) yield { file: relative(".", file), name };
		}
	}
}

/** `parseCandidate` returns every root/value split; keep the ones that produce CSS. */
function compiledCandidates(name: string): Candidate[] {
	return system
		.parseCandidate(name)
		.filter((candidate) => system.compileAstNodes(candidate).length > 0);
}

function problems(candidate: Candidate): string[] {
	const found: string[] = [];
	if (candidate.kind === "arbitrary") found.push("arbitrary property");
	if (candidate.variants.some((variant) => variant.kind === "arbitrary")) {
		found.push("arbitrary variant");
	}
	if (candidate.kind !== "functional") return found;
	if (candidate.value?.kind === "arbitrary") found.push("arbitrary value");
	if (candidate.modifier?.kind === "arbitrary")
		found.push("arbitrary modifier");
	const value =
		candidate.value?.kind === "named" ? candidate.value.value : undefined;
	if (value !== undefined) {
		if (SPACING_ROOT.test(candidate.root) && !STATIC_SPACING.has(value)) {
			found.push(`spacing ${value} is not a design system step`);
		}
		if (FLUID_SPACING_ROOT.test(candidate.root) && !FLUID_SPACING.has(value)) {
			found.push(`fluid spacing ${value} is not a design system step`);
		}
	}
	return found;
}

describe("class conformance", () => {
	it("finds classes to check", () => {
		expect([...classesWithFiles()].length).toBeGreaterThan(200);
	});

	it("every class generates CSS", () => {
		const unknown = [...classesWithFiles()].filter(
			({ name }) => system.candidatesToCss([name])[0] === null,
		);
		expect(unknown).toEqual([]);
	});

	it("uses no arbitrary values and only design system spacing steps", () => {
		const violations = [...classesWithFiles()].flatMap(({ file, name }) =>
			compiledCandidates(name).flatMap((candidate) =>
				problems(candidate).map((problem) => `${file}: ${name} (${problem})`),
			),
		);
		expect(violations).toEqual([]);
	});

	it("never transitions outline-color, so focus rings don't fade in", () => {
		// Walks every class the site actually uses (not just prose.css's two
		// consumers), so reverting a component like Button or Link back to
		// Tailwind's `transition-colors` fails here even though nothing else
		// in that component's own file checks for it.
		const fading = [...classesWithFiles()].filter(({ name }) =>
			/transition-property:[^;]*\b(outline-color|all)\b/.test(
				system.candidatesToCss([name])[0] ?? "",
			),
		);
		expect(fading).toEqual([]);
	});

	it("keeps the design system's container, not Tailwind's 65ch prose width", () => {
		expect(system.candidatesToCss(["max-w-measure"])[0]).toContain(
			"--container-measure",
		);
	});

	it("wires the ArticleList date column to the design system token", () => {
		expect(system.candidatesToCss(["grid-cols-log"])[0]).toContain(
			"--grid-template-columns-log",
		);
	});

	it("lets the ArticleList date column grow past 12ch instead of clipping wider text-spacing dates", () => {
		// theme.get resolves the value Tailwind actually uses, not just the first
		// declaration: a later redeclaration of the same variable would win at
		// runtime and this catches it, unlike a source-text search would.
		const value = system.theme.get(["--grid-template-columns-log"]) ?? "";
		expect(value.replace(/\s+/g, "")).toBe(
			"minmax(12ch,max-content)minmax(0,1fr)",
		);
	});

	it("renders ArticleList rows on the log column token", async () => {
		const source = await readFile(
			join(ROOT, "src/components/ArticleList.astro"),
			"utf8",
		);
		expect(source).toMatch(/<li class="[^"]*\bgrid-cols-log\b/);
	});
});

describe("DS-2 sync guards", () => {
	it("wraps CodeBlock file names and rules off the caption (DS-2 v98)", async () => {
		const css = await readFile(join(ROOT, "src/styles/components.css"), "utf8");
		const rule = (selector: string) => {
			const start = css.indexOf(`${selector} {`);
			return css.slice(start, css.indexOf("}", start));
		};
		const file = rule("[data-codeblock-file]");
		expect(file).toMatch(/overflow-wrap:\s*anywhere|\bwrap-anywhere\b/);
		expect(file).not.toMatch(/\btruncate\b|text-overflow|nowrap/);
		const caption = rule("[data-codeblock] > figcaption");
		expect(caption).toMatch(/\bborder-t\b/);
		expect(caption).toMatch(/\bborder-codeblock-line\b/);
		expect(caption).toMatch(/\bf6y-py-2\b/);
	});

	it("ends the Afacad Flux fallbacks in system-ui, so Astro emits all five metric-matched faces", async () => {
		// Astro builds its size-adjusted fallback faces from only the LAST entry
		// in `fallbacks` (BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue and
		// Arial for system-ui; Arial alone for sans-serif, and Android has no
		// Arial). Reordering silently reduces coverage without erroring.
		const config = await readFile(join(ROOT, "astro.config.ts"), "utf8");
		const afacad = config.slice(config.indexOf('name: "Afacad Flux"'));
		expect(afacad).toMatch(/fallbacks:\s*\[[^\]]*"system-ui"\s*\]/);
	});
});

describe("DS-100 sync guards", () => {
	it("wraps a long CodeBlock caption instead of letting it clip (DS-100 v100)", async () => {
		const css = await readFile(join(ROOT, "src/styles/components.css"), "utf8");
		const start = css.indexOf("[data-codeblock] > figcaption {");
		const caption = css.slice(start, css.indexOf("}", start));
		expect(caption).toMatch(/overflow-wrap:\s*anywhere|\bwrap-anywhere\b/);
	});

	it("gives font-mono its own feature settings, not the sans list (DS-100 v100)", () => {
		expect(system.theme.get(["--font-mono--font-feature-settings"])).toBe(
			'"zero"',
		);
		// Unchanged by this sync: sans keeps every feature it had.
		expect(system.theme.get(["--font-sans--font-feature-settings"])).toBe(
			'"calt", "pnum", "zero", "ss02"',
		);
	});

	it('carries "zero" on the font-mono utility', () => {
		const css = system.candidatesToCss(["font-mono"])[0] ?? "";
		expect(css).toContain(
			"font-feature-settings: var(--font-mono--font-feature-settings);",
		);
	});

	describe("compiled preflight and component rules", () => {
		let css: string;
		beforeAll(async () => {
			css = await compileGlobalCss(["font-mono", "font-sans"]);
		});

		/** The last `property:` declaration in a balanced `{...}` block: CSS applies the one written last. */
		function lastDeclaration(
			block: string,
			property: string,
		): string | undefined {
			const matches = [
				...block.matchAll(new RegExp(`${property}:\\s*([^;]+);`, "g")),
			];
			return matches.at(-1)?.[1];
		}

		/**
		 * Every balanced block for an exact selector. CSS nesting reuses `&` at
		 * every depth (prose.css nests a `:not(pre) > code` override two levels
		 * deep, inside `[data-callout]`, as well as the top-level one this
		 * suite cares about), so a plain text search can land on the wrong one.
		 */
		function ruleBlocks(selector: string): string[] {
			const marker = `${selector} {`;
			const blocks: string[] = [];
			let from = 0;
			for (;;) {
				const open = css.indexOf(marker, from);
				if (open === -1) return blocks;
				let depth = 1;
				let index = open + marker.length;
				while (depth > 0 && index < css.length) {
					if (css[index] === "{") depth++;
					else if (css[index] === "}") depth--;
					index++;
				}
				blocks.push(css.slice(open + marker.length, index - 1));
				from = index;
			}
		}

		it("resets preflight's code, kbd, samp and pre to the font's defaults", () => {
			const [block] = ruleBlocks("code, kbd, samp, pre");
			expect(block).toBeDefined();
			expect(lastDeclaration(block ?? "", "font-feature-settings")).toBe(
				"var(--default-mono-font-feature-settings, normal)",
			);
			expect(system.theme.get(["--default-mono-font-feature-settings"])).toBe(
				"normal",
			);
		});

		it("keeps body's sans text at all four features", () => {
			const [block] = ruleBlocks("body");
			expect(block).toBeDefined();
			expect(lastDeclaration(block ?? "", "font-feature-settings")).toBe(
				"var(--font-sans--font-feature-settings)",
			);
		});

		it.each([
			["kbd", "kbd"],
			["the CodeBlock <pre>", "[data-codeblock] pre"],
			["prose inline code", "& :not(pre) > code"],
			["prose's <pre>", "& pre"],
		])(
			"keeps %s at the font's defaults, not font-mono's zero",
			(_label, selector) => {
				const block = ruleBlocks(selector).find((candidate) =>
					candidate.includes("font-feature-settings"),
				);
				expect(
					block,
					`no ${selector} block sets font-feature-settings`,
				).toBeDefined();
				expect(lastDeclaration(block ?? "", "font-feature-settings")).toBe(
					"normal",
				);
			},
		);

		it("gives Mermaid SVG text the mono label's zero, not code's normal", () => {
			const [block] = ruleBlocks("[data-diagram] svg");
			expect(block).toBeDefined();
			expect(lastDeclaration(block ?? "", "font-feature-settings")).toBe(
				'"zero" !important',
			);
		});
	});
});
