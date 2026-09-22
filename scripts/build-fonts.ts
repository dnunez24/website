/**
 * Rebuild the self-hosted webfonts in `src/assets/fonts` from their upstream
 * sources, keeping the OpenType features listed in `scripts/fonts.config.ts`.
 *
 * Provider-served webfonts (Google Fonts, Fontsource) arrive pre-subset with
 * harfbuzz's default layout-feature list, so stylistic sets and other
 * discretionary features are already gone before the browser sees them. To
 * turn a new feature on: add its tag to `features`, rerun, and add it to
 * `--font-sans--font-feature-settings` in `src/styles/theme.css`.
 *
 * Requires Node >= 22.18, which runs TypeScript without a build step.
 *
 *   pnpm fonts:build                     rebuild every configured family
 *   pnpm fonts:features                  list the features each source offers
 *   node scripts/build-fonts.ts --refetch        ignore the cached sources
 *   node scripts/build-fonts.ts --only=<stem>    build one family
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";
import { FONTS, type FontBuild, SUBSETS } from "./fonts.config.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT_DIR = join(ROOT, "src/assets/fonts");
const CACHE_DIR = join(ROOT, "node_modules/.cache/fonts");

/** `0x00010000` is TrueType outlines, `OTTO` is CFF. */
const SFNT_VERSIONS = new Set([0x00010000, 0x4f54544f]);

/**
 * `keepFeatures` filters GPOS too, so leaving these out of a config silently
 * ships a font with no kerning or mark positioning.
 */
const POSITIONING_FEATURES = ["kern", "mark", "mkmk"];

/** Expands `U+xxxx` / `U+xxxx-yyyy` ranges into the text hb-subset keeps. */
function expandUnicodeRanges(ranges: string[]): string {
	const characters: string[] = [];

	for (const range of ranges) {
		const [startHex, endHex] = range.trim().replace(/^U\+/i, "").split("-");
		if (!startHex) throw new Error(`Malformed unicode range: ${range}`);

		const start = Number.parseInt(startHex, 16);
		const end = endHex === undefined ? start : Number.parseInt(endHex, 16);
		if (Number.isNaN(start) || Number.isNaN(end)) {
			throw new Error(`Malformed unicode range: ${range}`);
		}

		for (let code = start; code <= end; code++) {
			// Lone surrogates cannot appear in a well-formed string.
			if (code >= 0xd800 && code <= 0xdfff) continue;
			characters.push(String.fromCodePoint(code));
		}
	}

	return characters.join("");
}

/**
 * Reads the feature tags a font declares, straight out of the GSUB/GPOS
 * feature lists. Used to catch tags that a source does not actually have,
 * which would otherwise fail silently exactly like the stripped ones did.
 */
function readFeatureTags(font: Buffer): Set<string> {
	const tags = new Set<string>();

	if (!SFNT_VERSIONS.has(font.readUInt32BE(0))) {
		throw new Error("Source font must be an uncompressed TTF or OTF");
	}

	const tableCount = font.readUInt16BE(4);
	for (let index = 0; index < tableCount; index++) {
		const record = 12 + index * 16;
		const tag = font.toString("ascii", record, record + 4);
		if (tag !== "GSUB" && tag !== "GPOS") continue;

		// Both tables share a header whose third offset is the feature list.
		const table = font.readUInt32BE(record + 8);
		const featureList = table + font.readUInt16BE(table + 6);
		const featureCount = font.readUInt16BE(featureList);

		for (let feature = 0; feature < featureCount; feature++) {
			const entry = featureList + 2 + feature * 6;
			tags.add(font.toString("ascii", entry, entry + 4));
		}
	}

	return tags;
}

async function download(url: string, destination: string): Promise<Buffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`GET ${url} failed: ${response.status} ${response.statusText}`,
		);
	}

	const body = Buffer.from(await response.arrayBuffer());
	await mkdir(dirname(destination), { recursive: true });
	await writeFile(destination, body);
	return body;
}

async function loadSource(build: FontBuild, refetch: boolean): Promise<Buffer> {
	const name = basename(decodeURIComponent(new URL(build.source).pathname));
	const cached = join(CACHE_DIR, name);

	if (!refetch) {
		try {
			return await readFile(cached);
		} catch {
			// Not cached yet.
		}
	}

	console.log(`  fetching ${build.source}`);
	return download(build.source, cached);
}

function formatKilobytes(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} kB`;
}

async function sizeOf(path: string): Promise<number | undefined> {
	try {
		return (await readFile(path)).byteLength;
	} catch {
		return undefined;
	}
}

async function build(builds: FontBuild[], refetch: boolean): Promise<void> {
	await mkdir(OUTPUT_DIR, { recursive: true });

	for (const font of builds) {
		console.log(`\n${font.family}`);

		const source = await loadSource(font, refetch);
		const available = readFeatureTags(source);
		const keepFeatures = font.features?.filter((tag) => available.has(tag));
		const missing = font.features?.filter((tag) => !available.has(tag)) ?? [];

		if (missing.length > 0) {
			console.warn(
				`  warning: source has no ${missing.join(", ")} — dropped from this build`,
			);
		}

		const unkerned = POSITIONING_FEATURES.filter(
			(tag) =>
				available.has(tag) && keepFeatures && !keepFeatures.includes(tag),
		);
		if (unkerned.length > 0) {
			console.warn(
				`  warning: ${unkerned.join(", ")} not in \`features\` — text will render unkerned`,
			);
		}

		for (const variant of font.variants) {
			for (const subset of font.subsets) {
				const file = `${font.stem}-${subset}-${variant.label}-${variant.style}.woff2`;
				const path = join(OUTPUT_DIR, file);
				const before = await sizeOf(path);

				const output = await subsetFont(
					source,
					expandUnicodeRanges(SUBSETS[subset]),
					{
						targetFormat: "woff2",
						noHinting: true,
						...(keepFeatures ? { keepFeatures } : {}),
						...(variant.axes ? { variationAxes: variant.axes } : {}),
					},
				);
				await writeFile(path, output);

				const delta =
					before === undefined
						? "new"
						: before === output.byteLength
							? "unchanged"
							: `was ${formatKilobytes(before)}`;
				console.log(
					`  ${relative(ROOT, path)}  ${formatKilobytes(output.byteLength)} (${delta})`,
				);
			}
		}

		if (font.license) {
			const path = join(OUTPUT_DIR, `${font.stem}-${basename(font.license)}`);
			await download(font.license, path);
			console.log(`  ${relative(ROOT, path)}`);
		}
	}
}

async function listFeatures(
	builds: FontBuild[],
	refetch: boolean,
): Promise<void> {
	for (const font of builds) {
		const available = readFeatureTags(await loadSource(font, refetch));
		const kept = new Set(font.features ?? available);

		console.log(`\n${font.family} — ${available.size} features in source`);
		for (const tag of [...available].sort()) {
			console.log(`  ${kept.has(tag) ? "kept   " : "dropped"} ${tag}`);
		}
	}
}

const args = process.argv.slice(2);
const only = args
	.find((arg) => arg.startsWith("--only="))
	?.slice("--only=".length);
const refetch = args.includes("--refetch");

const builds = only ? FONTS.filter((font) => font.stem === only) : FONTS;
if (builds.length === 0) {
	const stems = FONTS.map((font) => font.stem).join(", ");
	throw new Error(`No font family with stem "${only}". Configured: ${stems}`);
}

if (args.includes("--features")) {
	await listFeatures(builds, refetch);
} else {
	await build(builds, refetch);
}
