import { beforeAll, describe, expect, it } from "vitest";
import { loadDesignSystem } from "../test/classes";

type DesignSystem = Awaited<ReturnType<typeof loadDesignSystem>>;

/**
 * One concrete Tailwind class per pattern DESIGN.md's Building and Layout &
 * Spacing sections tell a coding agent to write (`f6y-p-2` stands for the
 * whole `f6y-*-2` family, applicable to any property root, and so on).
 * Kept here explicitly, rather than scraped from the prose, so a wording
 * change in DESIGN.md can't silently stop testing anything: keep this list
 * in sync by hand when that prose changes.
 */
const CLASSES_DESIGN_MD_TEACHES = [
	// space-1, space-2: Tailwind's own fixed steps.
	"p-0.5",
	"gap-1",
	// space-3 .. space-7: the fluidity-tailwind plugin's f6y-* utilities.
	"f6y-p-2",
	"f6y-p-4",
	"f6y-p-8",
	"f6y-p-16",
	"f6y-p-32",
	// Prose rhythm.
	"mt-line",
	"mt-line-half",
	"mt-line-quarter",
	"mt-line-double",
	// container-prose and its breakpoint.
	"max-w-measure",
	"measure:flex-row",
	// duration-*: bare numeric utilities, no theme token needed.
	"duration-64",
	"duration-128",
	"duration-256",
	"duration-512",
	// stroke-*: Tailwind's own default border/outline/decoration scale.
	"border",
	"decoration-2",
	"outline-4",
	"outline-offset-2",
];

describe("DESIGN.md's Building and Layout guidance matches main's real utilities", () => {
	let system: DesignSystem;

	beforeAll(async () => {
		system = await loadDesignSystem();
	});

	it("every class DESIGN.md tells an agent to write actually compiles", () => {
		const unknown = CLASSES_DESIGN_MD_TEACHES.filter(
			(name) => system.candidatesToCss([name])[0] === null,
		);
		expect(unknown).toEqual([]);
	});

	it("uses no arbitrary values, the same ban conformance.test.ts enforces", () => {
		const arbitrary = CLASSES_DESIGN_MD_TEACHES.filter((name) =>
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
});
