import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { __unstable__loadDesignSystem } from "tailwindcss";

const require = createRequire(import.meta.url);
export const ROOT = resolve(import.meta.dirname, "../..");

/** Resolves `@import`s the way the Vite plugin does: packages by their `style` entry, files relatively. */
async function loadStylesheet(id: string, base: string) {
	const path = id.startsWith(".")
		? join(base, id)
		: join(dirname(require.resolve(`${id}/package.json`)), "index.css");
	return { path, base: dirname(path), content: await readFile(path, "utf8") };
}

export async function loadDesignSystem() {
	const entry = join(ROOT, "src/styles/global.css");
	return __unstable__loadDesignSystem(await readFile(entry, "utf8"), {
		base: dirname(entry),
		loadStylesheet,
	});
}

const CLASS_TOKEN = /^[!a-z0-9:*\-/.]+$/;
const splitClasses = (value: string) => value.split(/\s+/).filter(Boolean);

/** The expression inside each `class:list={…}`, braces balanced. */
function* classListExpressions(source: string) {
	for (const match of source.matchAll(/class:list=\{/g)) {
		const start = (match.index ?? 0) + match[0].length;
		let depth = 1;
		let end = start;
		while (end < source.length && depth > 0) {
			if (source[end] === "{") depth++;
			if (source[end] === "}") depth--;
			end++;
		}
		yield source.slice(start, end - 1);
	}
}

/**
 * Class names written in an `.astro` file: `class` attributes, string literals
 * and object keys inside `class:list`, and frontmatter strings made only of
 * class-like tokens (for lookup tables such as Button's variants).
 */
export function extractAstroClasses(source: string): string[] {
	const classes: string[] = [];
	for (const [, value = ""] of source.matchAll(/\sclass="([^"]*)"/g)) {
		classes.push(...splitClasses(value));
	}
	for (const body of classListExpressions(source)) {
		for (const [, value = ""] of body.matchAll(/"([^"]*)"/g)) {
			classes.push(...splitClasses(value));
		}
	}
	const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	for (const [, value = ""] of frontmatter.matchAll(/"([^"\n]*)"/g)) {
		const tokens = splitClasses(value);
		if (
			tokens.length >= 2 &&
			tokens.every((token) => CLASS_TOKEN.test(token))
		) {
			classes.push(...tokens);
		}
	}
	return classes;
}

/** Utilities named in `@apply` rules. */
export function extractApplyClasses(source: string): string[] {
	return [...source.matchAll(/@apply\s+([^;]+);/g)].flatMap(([, value = ""]) =>
		splitClasses(value),
	);
}
