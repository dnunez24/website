import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..", "..");

/**
 * Both files write decimal literals with no arithmetic between them, so
 * exact equality is the intent. A tiny epsilon only guards against
 * incidental float noise (e.g. "77" vs "77.0"), not real token drift: it
 * must stay far below the palette's smallest recorded step (0.001).
 */
const EPSILON = 1e-9;

/**
 * Color tokens that differ from theme.css today because an open PR hasn't
 * landed yet. One place, one PR number each, with the exact value theme.css
 * holds right now (`themeValueBefore`, omitted if the token doesn't exist in
 * theme.css yet). The main comparison below accepts a pending token at
 * EITHER its documented "before" value or DESIGN.md's ("after") value; any
 * third value is real, unrelated drift and fails immediately. That also
 * means merge order doesn't matter: if the PR lands before this file does,
 * these tokens are simply already at their "after" value and stop being
 * treated as different, with no edit to this file required.
 */
const PENDING_DIFFERENCES: Record<
	string,
	{ pr: string; themeValueBefore?: string }
> = {
	"color-quote-ink": { pr: "#30", themeValueBefore: "oklch(40.0% 0.031 78.5)" }, // earth-800
	"color-quote-cite": { pr: "#30", themeValueBefore: "oklch(48.1% 0.044 77)" }, // earth-600
	"color-quote-link": { pr: "#30" }, // new token, not yet in theme.css
	"color-quote-link-hover": { pr: "#30" }, // new token, not yet in theme.css
};

/** Matches a whole value of the form `oklch(L% C H)` and captures its three numeric components. */
const OKLCH_RE = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/;

function parseOklch(value: string): [number, number, number] | null {
	const [, l = "", c = "", h = ""] = OKLCH_RE.exec(value.trim()) ?? [];
	if (!l || !c || !h) return null;
	return [Number(l), Number(c), Number(h)];
}

function sameOklch(a: string, b: string): boolean | null {
	const oklchA = parseOklch(a);
	const oklchB = parseOklch(b);
	if (!oklchA || !oklchB) return null;
	return (
		Math.abs(oklchA[0] - oklchB[0]) <= EPSILON &&
		Math.abs(oklchA[1] - oklchB[1]) <= EPSILON &&
		Math.abs(oklchA[2] - oklchB[2]) <= EPSILON
	);
}

/**
 * Extracts DESIGN.md's `colors:` front-matter map (`name: "value"` entries,
 * two-space indent) and resolves single-hop `{colors.other-name}` references
 * to their literal value, the same way the design system's own tokens.json
 * aliases a semantic color to a palette step. Throws on any non-blank,
 * non-comment line under `colors:` that isn't in that exact shape, rather
 * than silently skipping it: a value in single quotes, missing quotes, or
 * any other shape the linter would still accept must not go uncompared.
 */
function parseDesignMdColors(source: string): Map<string, string> {
	const body = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1];
	if (body === undefined) throw new Error("DESIGN.md has no YAML front matter");
	const lines = body.split(/\r?\n/);

	const start = lines.indexOf("colors:");
	if (start === -1) {
		throw new Error("DESIGN.md front matter has no `colors:` key");
	}

	const raw = new Map<string, string>();
	const entry = /^\s{2}([a-zA-Z0-9-]+):\s*"([^"]*)"\s*$/;
	for (const line of lines.slice(start + 1)) {
		if (line === "" || line.trimStart().startsWith("#")) continue;
		if (!/^\s/.test(line)) break; // the next top-level key
		const [, name = "", value = ""] = entry.exec(line) ?? [];
		if (!name) {
			throw new Error(
				`DESIGN.md: unrecognized line under \`colors:\` (expected \`  name: "value"\`): ${line}`,
			);
		}
		raw.set(name, value);
	}

	const ref = /^\{colors\.([a-zA-Z0-9-]+)\}$/;
	const resolved = new Map<string, string>();
	for (const [name, value] of raw) {
		const target = ref.exec(value)?.[1];
		if (target === undefined) {
			resolved.set(name, value);
			continue;
		}
		const aliased = raw.get(target);
		if (aliased === undefined) {
			throw new Error(
				`DESIGN.md: ${name} references undefined token ${target}`,
			);
		}
		resolved.set(name, aliased);
	}
	return resolved;
}

/**
 * Extracts every `--color-*` custom property from theme.css and resolves a
 * single-hop `var(--color-other)` indirection to its literal value.
 */
function parseThemeCssColors(source: string): Map<string, string> {
	const raw = new Map<string, string>();
	for (const [, name = "", value = ""] of source.matchAll(
		/--(color-[a-zA-Z0-9-]+):\s*([^;]+);/g,
	)) {
		if (name) raw.set(name, value.trim());
	}

	const ref = /^var\(--(color-[a-zA-Z0-9-]+)\)$/;
	const resolved = new Map<string, string>();
	for (const [name, value] of raw) {
		const target = ref.exec(value)?.[1];
		if (target === undefined) {
			resolved.set(name, value);
			continue;
		}
		const aliased = raw.get(target);
		if (aliased === undefined) {
			throw new Error(`theme.css: --${name} references undefined --${target}`);
		}
		resolved.set(name, aliased);
	}
	return resolved;
}

describe("DESIGN.md color tokens", () => {
	let designMdColors: Map<string, string>;
	let themeCssColors: Map<string, string>;

	beforeAll(async () => {
		const [designMdSource, themeCssSource] = await Promise.all([
			readFile(resolve(ROOT, "DESIGN.md"), "utf8"),
			readFile(resolve(ROOT, "src/styles/theme.css"), "utf8"),
		]);
		designMdColors = parseDesignMdColors(designMdSource);
		themeCssColors = parseThemeCssColors(themeCssSource);
	});

	it("finds color tokens in both files", () => {
		expect(designMdColors.size).toBeGreaterThan(50);
		expect(themeCssColors.size).toBeGreaterThan(50);
	});

	it("matches every color token between DESIGN.md and theme.css, compared as oklch", () => {
		const problems: string[] = [];

		for (const [name, designValue] of designMdColors) {
			const pending = Object.hasOwn(PENDING_DIFFERENCES, name)
				? PENDING_DIFFERENCES[name]
				: undefined;
			const themeValue = themeCssColors.get(name);

			if (pending) {
				if (themeValue === undefined) {
					if (pending.themeValueBefore !== undefined) {
						problems.push(
							`${name}: expected in theme.css (as ${pending.themeValueBefore}, pending ${pending.pr}) but missing entirely`,
						);
					}
					// else: documented as not-yet-added by pending.pr. Expected.
					continue;
				}
				const matchesBefore =
					pending.themeValueBefore !== undefined &&
					sameOklch(themeValue, pending.themeValueBefore);
				const matchesAfter = sameOklch(themeValue, designValue);
				if (!matchesBefore && !matchesAfter) {
					problems.push(
						`${name}: theme.css "${themeValue}" is neither the documented pre-${pending.pr} value` +
							(pending.themeValueBefore !== undefined
								? ` ("${pending.themeValueBefore}")`
								: "") +
							` nor DESIGN.md's ("${designValue}"). Real drift: update PENDING_DIFFERENCES.`,
					);
				}
				// else: still at the documented "before" value, or #30 already landed. Expected either way.
				continue;
			}

			if (themeValue === undefined) {
				problems.push(`${name}: in DESIGN.md but not in theme.css`);
				continue;
			}

			const same = sameOklch(designValue, themeValue);
			if (same === null) {
				problems.push(
					`${name}: not comparable as oklch (DESIGN.md "${designValue}", theme.css "${themeValue}")`,
				);
			} else if (!same) {
				problems.push(
					`${name}: DESIGN.md "${designValue}" != theme.css "${themeValue}"`,
				);
			}
		}

		for (const name of themeCssColors.keys()) {
			if (Object.hasOwn(PENDING_DIFFERENCES, name)) continue;
			if (name === "color-media-ground") continue; // checked on its own below
			if (!designMdColors.has(name)) {
				problems.push(`${name}: in theme.css but not in DESIGN.md`);
			}
		}

		expect(problems).toEqual([]);
	});

	// theme.css's color-media-ground has no DESIGN.md token of its own: the
	// design system's Media guidance points straight at the color-concrete-200
	// palette step (see DESIGN.md's Colors section), not a semantic alias.
	// Check the value it actually resolves to, rather than skipping it.
	it("resolves theme.css's color-media-ground to DESIGN.md's color-concrete-200", () => {
		const mediaGround = themeCssColors.get("color-media-ground");
		const concrete200 = designMdColors.get("color-concrete-200");
		expect(
			mediaGround,
			"theme.css should define --color-media-ground",
		).toBeDefined();
		expect(
			concrete200,
			"DESIGN.md should define color-concrete-200",
		).toBeDefined();
		expect(sameOklch(mediaGround ?? "", concrete200 ?? "")).toBe(true);
	});
});
