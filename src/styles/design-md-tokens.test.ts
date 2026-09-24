import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..", "..");
const EPSILON = 0.001;

/**
 * Color tokens that legitimately differ between DESIGN.md (the approved
 * design system) and theme.css (main) because an open PR hasn't landed yet.
 * One place, one PR number each. Remove an entry once its PR merges and
 * theme.css catches up — the comparison below then holds that token to
 * strict equality like every other one.
 */
const PENDING_DIFFERENCES: Record<string, string> = {
	"color-quote-ink":
		"#30 (claude/prose-quotes-footnotes): earth-800 -> earth-700",
	"color-quote-cite":
		"#30 (claude/prose-quotes-footnotes): earth-600 -> earth-500",
	"color-quote-link":
		"#30 (claude/prose-quotes-footnotes): new token, not yet in theme.css",
	"color-quote-link-hover":
		"#30 (claude/prose-quotes-footnotes): new token, not yet in theme.css",
};

/**
 * theme.css tokens the design system deliberately doesn't name. Media's
 * guidance in DESIGN.md points straight at the `color-concrete-200` palette
 * step; `color-media-ground` is only theme.css's local alias for it, not a
 * design-system token with a counterpart to compare against. Not a pending
 * sync — there is no token to add on either side.
 */
const UNNAMED_BY_DESIGN = new Set(["color-media-ground"]);

/** Matches `oklch(L% C H)` and captures its three numeric components. */
const OKLCH_RE = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/;

function parseOklch(value: string): [number, number, number] | null {
	const [, l = "", c = "", h = ""] = OKLCH_RE.exec(value) ?? [];
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
 * aliases a semantic color to a palette step.
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
		if (name) raw.set(name, value);
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
			if (name in PENDING_DIFFERENCES) continue;

			const themeValue = themeCssColors.get(name);
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
			if (name in PENDING_DIFFERENCES || UNNAMED_BY_DESIGN.has(name)) continue;
			if (!designMdColors.has(name)) {
				problems.push(`${name}: in theme.css but not in DESIGN.md`);
			}
		}

		expect(problems).toEqual([]);
	});

	it("keeps the pending-differences list from going stale", () => {
		const stale: string[] = [];

		for (const [name, reason] of Object.entries(PENDING_DIFFERENCES)) {
			const designValue = designMdColors.get(name);
			if (designValue === undefined) {
				stale.push(
					`${name}: no longer in DESIGN.md (${reason}) — drop it from the list`,
				);
				continue;
			}

			const themeValue = themeCssColors.get(name);
			if (themeValue === undefined) continue; // still not synced: expected

			if (sameOklch(designValue, themeValue)) {
				stale.push(
					`${name}: DESIGN.md and theme.css now match (${reason}) — drop it from the list`,
				);
			}
		}

		expect(stale).toEqual([]);
	});
});
