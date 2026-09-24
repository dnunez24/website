import { glob, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
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

	it("lets the ArticleList date column grow past 12ch instead of clipping wider text-spacing dates", async () => {
		const theme = await readFile(join(ROOT, "src/styles/theme.css"), "utf8");
		expect(theme).toContain(
			"--grid-template-columns-log: minmax(12ch, max-content) minmax(0, 1fr);",
		);
	});
});
