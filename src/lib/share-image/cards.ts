import { SITE_TAGLINE, SITE_TITLE } from "@constants";
import sharp from "sharp";
import {
	loadFaces,
	outline,
	type ShapedLine,
	shapeLine,
	sideBearing,
	type TypeFace,
} from "./fonts";
import { type ArticleFit, fitArticle } from "./layout";

/** The design system's ShareImage: the default card and each article's card. */
export const CARD = { width: 1200, height: 630 } as const;

/** Palette steps in hex, since SVG renderers don't read oklch. Tests check them against `theme.css`. */
export const COLORS = {
	ground: "#ededec", // concrete-100, color-surface
	ink: "#414e3e", // evergreen-800
	muted: "#585855", // concrete-600, color-ink-muted
	// The wedge's bands, outside in: evergreen-800, 600, 400.
	bands: ["#414e3e", "#52654c", "#91a38b"],
} as const;

/**
 * 21.5°: on the default card, the wedge's outer edge runs from the right
 * edge's midpoint to the left third line along the bottom.
 */
export const SLOPE = CARD.height / 2 / ((CARD.width * 2) / 3);

const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;

const document = (body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${CARD.width} ${CARD.height}"><rect width="100%" height="100%" fill="${COLORS.ground}"/>${body}</svg>`;

const round = (value: number) => Math.round(value * 100) / 100;

/** Three equal bands in a bottom corner; `run` is the outer edge's length along the bottom. */
function wedge(run: number, corner: "left" | "right"): string {
	return COLORS.bands
		.map((color, index) => {
			const along = run * (1 - index / 3);
			const up = round(CARD.height - SLOPE * along);
			return path(
				corner === "left"
					? `M0 ${up}L${round(along)} ${CARD.height}H0Z`
					: `M${CARD.width} ${up}L${round(CARD.width - along)} ${CARD.height}H${CARD.width}Z`,
				color,
			);
		})
		.join("");
}

const line = (
	face: TypeFace,
	shaped: ShapedLine,
	x: number,
	baseline: number,
	size: number,
	fill: string,
) => path(outline(face, shaped, x, baseline, size), fill);

const DEFAULT = {
	/** Both lines start here, measured to the letters. */
	left: 96,
	/** On the midline, level with the top of the wedge. */
	taglineBaseline: CARD.height / 2,
	/** From the name's baseline to the tagline's. */
	lineGap: 68,
	name: { size: 128, tracking: -0.02 },
	tagline: { size: 36 },
} as const;

/** The card for every page but articles: the name and tagline beside the wedge. */
export async function defaultCardSvg(): Promise<string> {
	const { sans, mono } = await loadFaces();
	const { name, tagline } = DEFAULT;
	const nameLine = shapeLine(sans, SITE_TITLE, name.size, name.tracking);
	const taglineLine = shapeLine(mono, SITE_TAGLINE, tagline.size);
	// Aligned text boxes would leave the stems apart: the D carries more built-in space at 128px than the L at 36px.
	return document(
		wedge((CARD.width * 2) / 3, "right") +
			line(
				sans,
				nameLine,
				DEFAULT.left - sideBearing(sans, nameLine, name.size),
				DEFAULT.taglineBaseline - DEFAULT.lineGap,
				name.size,
				COLORS.ink,
			) +
			line(
				mono,
				taglineLine,
				DEFAULT.left - sideBearing(mono, taglineLine, tagline.size),
				DEFAULT.taglineBaseline,
				tagline.size,
				COLORS.muted,
			),
	);
}

export const ARTICLE = {
	/** On every side, measured to the letters: capitals at the top, the tagline's baseline at the bottom. */
	margin: 64,
	/** The default card's wedge at 3/4 size, so titles keep their room. */
	wedgeRun: CARD.width / 2,
	/** Between the text and the wedge, where the wedge crosses the left margin. */
	clearance: 64,
	title: { sizes: [96, 80, 64], leading: 1.05, tracking: -0.02 },
	subtitle: { size: 36, lineHeight: 36 * 1.3, gap: 65, maxLines: 2 },
	name: { size: 48, tracking: -0.01 },
	tagline: { size: 20, gap: 34 },
} as const;

export interface CardArticle {
	title: string;
	subtitle?: string | undefined;
}

/** An article's card: its title and subtitle, the byline, and the wedge mirrored at 3/4 size. */
export async function articleCardSvg(
	article: CardArticle,
): Promise<{ svg: string; fit: ArticleFit }> {
	const { sans, mono } = await loadFaces();
	const { margin, title, subtitle, name, tagline } = ARTICLE;
	const maxWidth = CARD.width - 2 * margin;
	const firstBaseline = (size: number) =>
		margin + (sans.capHeight / sans.upem) * size;
	const wedgeAtMargin = CARD.height - SLOPE * ARTICLE.wedgeRun + SLOPE * margin;
	const fit = fitArticle(article.title, article.subtitle, {
		sizes: title.sizes,
		measureTitle: (size) => (text) =>
			shapeLine(sans, text, size, title.tracking).width,
		measureSubtitle: (text) => shapeLine(mono, text, subtitle.size).width,
		maxWidth,
		firstBaseline,
		floor: wedgeAtMargin - ARTICLE.clearance,
		titleLeading: title.leading,
		subtitle,
	});

	const first = firstBaseline(fit.size);
	const step = fit.size * title.leading;
	const subtitleTop = first + (fit.lines.length - 1) * step + subtitle.gap;
	const taglineBaseline = CARD.height - margin;
	const nameLine = shapeLine(sans, SITE_TITLE, name.size, name.tracking);
	const taglineLine = shapeLine(mono, SITE_TAGLINE, tagline.size);
	const body = [
		wedge(ARTICLE.wedgeRun, "left"),
		...fit.lines.map((text, index) =>
			line(
				sans,
				shapeLine(sans, text, fit.size, title.tracking),
				margin,
				first + index * step,
				fit.size,
				COLORS.ink,
			),
		),
		...fit.subtitleLines.map((text, index) =>
			line(
				mono,
				shapeLine(mono, text, subtitle.size),
				margin,
				subtitleTop + index * subtitle.lineHeight,
				subtitle.size,
				COLORS.muted,
			),
		),
		// The byline hangs from the right margin, the tagline's baseline on the bottom one.
		line(
			sans,
			nameLine,
			CARD.width - margin - nameLine.width,
			taglineBaseline - tagline.gap,
			name.size,
			COLORS.ink,
		),
		line(
			mono,
			taglineLine,
			CARD.width - margin - taglineLine.width,
			taglineBaseline,
			tagline.size,
			COLORS.muted,
		),
	];
	return { svg: document(body.join("")), fit };
}

/**
 * Rasterizes a card at its own 1200 × 630. Every card is fully opaque, so
 * drop the alpha channel: RGB instead of RGBA, lossless. `compressionLevel`
 * maxes out zlib's effort, free at build time. `effort`, `quality`, `colours`
 * and `dither` are left unset: each one switches sharp to lossy palette
 * output (`isPalette: true`), at any value.
 */
export async function toPng(svg: string): Promise<Uint8Array<ArrayBuffer>> {
	return new Uint8Array(
		await sharp(Buffer.from(svg))
			.removeAlpha()
			.png({ compressionLevel: 9 })
			.toBuffer(),
	);
}
