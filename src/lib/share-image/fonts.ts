import { readFile } from "node:fs/promises";
import * as hb from "harfbuzzjs";
import { decompress } from "wawoff2";

/** A font ready to shape, with the OpenType features the site gives it. */
export interface TypeFace {
	font: hb.Font;
	upem: number;
	/** In font units, for placing a line by the top of its capitals. */
	capHeight: number;
	features: hb.Feature[];
	outlines: Map<number, ReturnType<hb.Font["glyphToJson"]>>;
}

/** Glyphs placed along one line from its origin, and the line's advance width. */
export interface ShapedLine {
	glyphs: { id: number; x: number; y: number }[];
	width: number;
}

const feature = (tag: string) => {
	const parsed = hb.Feature.fromString(tag);
	if (!parsed) throw new Error(`Not an OpenType feature: ${tag}`);
	return parsed;
};

/**
 * The OpenType features `theme.css` turns on for sans text. The cards read
 * the token itself, so their type can't drift from the page's.
 */
export async function sansFeatures(): Promise<string[]> {
	const css = await readFile("src/styles/theme.css", "utf8");
	const value = /--font-sans--font-feature-settings:\s*([^;]+);/.exec(css)?.[1];
	if (!value) {
		throw new Error(
			"theme.css no longer sets --font-sans--font-feature-settings",
		);
	}
	return [...value.matchAll(/"([a-z0-9]{4})"/g)].flatMap(([, tag]) =>
		tag ? [tag] : [],
	);
}

async function load(
	file: string,
	weight: number,
	features: string[],
): Promise<TypeFace> {
	// HarfBuzz reads TrueType, not WOFF2: unwrap the same files the site serves.
	const sfnt = await decompress(await readFile(`src/assets/fonts/${file}`));
	const face = new hb.Face(new hb.Blob(sfnt));
	const font = new hb.Font(face);
	font.setVariations([new hb.Variation("wght", weight)]);
	return {
		font,
		upem: face.upem,
		capHeight: font.getMetricPositionWithFallback(hb.MetricsTag.CAP_HEIGHT),
		features: features.map(feature),
		outlines: new Map(),
	};
}

let faces: Promise<{ sans: TypeFace; mono: TypeFace }> | undefined;

/** The site's sans at weight 600 and mono at 400, loaded once per build. */
export function loadFaces() {
	faces ??= (async () => {
		const [sans, mono] = await Promise.all([
			load("afacad-flux-latin-wght-normal.woff2", 600, await sansFeatures()),
			// The site sets no features on mono, so it shapes with the defaults, as browsers do.
			load("jetbrains-mono-latin-wght-normal.woff2", 400, []),
		]);
		return { sans, mono };
	})();
	return faces;
}

const NO_LIGATURES = ["-liga", "-clig"].map(feature);

/** Shapes one line, with letter spacing (`tracking`, in em) as CSS applies it. */
export function shapeLine(
	face: TypeFace,
	text: string,
	size: number,
	tracking = 0,
): ShapedLine {
	const buffer = new hb.Buffer();
	buffer.addText(text);
	buffer.guessSegmentProperties();
	// Browsers drop common ligatures once letter spacing isn't zero.
	hb.shape(
		face.font,
		buffer,
		tracking ? [...face.features, ...NO_LIGATURES] : face.features,
	);
	const infos = buffer.getGlyphInfos();
	const positions = buffer.getGlyphPositions();
	const scale = size / face.upem;
	let x = 0;
	const glyphs = infos.map((info, index) => {
		const position = positions[index];
		const glyph = {
			id: info.codepoint,
			x: x + (position?.xOffset ?? 0) * scale,
			y: (position?.yOffset ?? 0) * scale,
		};
		x += (position?.xAdvance ?? 0) * scale;
		// CSS adds the spacing after every character, the last included.
		if (infos[index + 1]?.cluster !== info.cluster) x += tracking * size;
		return glyph;
	});
	return { glyphs, width: x };
}

function commands(face: TypeFace, glyph: number) {
	let outline = face.outlines.get(glyph);
	if (!outline) {
		outline = face.font.glyphToJson(glyph);
		face.outlines.set(glyph, outline);
	}
	return outline;
}

/** From a line's origin to the left edge of its first letter: the space built into the glyph. */
export function sideBearing(
	face: TypeFace,
	line: ShapedLine,
	size: number,
): number {
	const first = line.glyphs[0];
	if (!first) return 0;
	const xs = commands(face, first.id).flatMap(({ values }) =>
		values.filter((_, index) => index % 2 === 0),
	);
	return first.x + (Math.min(...xs) * size) / face.upem;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** A shaped line as SVG path data, its origin on the baseline at `x`. */
export function outline(
	face: TypeFace,
	line: ShapedLine,
	x: number,
	baseline: number,
	size: number,
): string {
	const scale = size / face.upem;
	return line.glyphs
		.flatMap((glyph) =>
			commands(face, glyph.id).map(({ type, values }) => {
				// Font units point up; SVG's y axis points down.
				const points = values.map((value, index) =>
					round(
						index % 2 === 0
							? x + glyph.x + value * scale
							: baseline - glyph.y - value * scale,
					),
				);
				return `${type}${points.join(" ")}`;
			}),
		)
		.join("");
}
