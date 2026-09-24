import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
	ARTICLE,
	articleCardSvg,
	CARD,
	COLORS,
	defaultCardSvg,
	toPng,
} from "./cards";
import { loadFaces, sansFeatures, shapeLine } from "./fonts";

/** The `d` of every path in a card, in drawing order: the wedge's three bands, then each line of text. */
const paths = (svg: string) =>
	[...svg.matchAll(/<path d="([^"]+)"/g)].map(([, d]) => d ?? "");

/** A path's ink box, from the coordinates of its commands. */
function box(d: string) {
	const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
	const xs = values.filter((_, index) => index % 2 === 0);
	const ys = values.filter((_, index) => index % 2 === 1);
	return {
		left: Math.min(...xs),
		right: Math.max(...xs),
		top: Math.min(...ys),
		bottom: Math.max(...ys),
	};
}

/** OKLCH to sRGB hex, per the CSS Color 4 conversion. */
function oklchToHex(lightness: number, chroma: number, hue: number) {
	const a = chroma * Math.cos((hue * Math.PI) / 180);
	const b = chroma * Math.sin((hue * Math.PI) / 180);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
	const encode = (channel: number) => {
		const c = Math.min(1, Math.max(0, channel));
		const gamma = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
		return Math.round(gamma * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${linear.map(encode).join("")}`;
}

async function token(name: string) {
	const css = await readFile("src/styles/theme.css", "utf8");
	const match = new RegExp(
		`--color-${name}: oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\)`,
	).exec(css);
	if (!match) throw new Error(`No --color-${name} in theme.css`);
	const [, lightness, chroma, hue] = match.map(Number);
	return oklchToHex((lightness ?? 0) / 100, chroma ?? 0, hue ?? 0);
}

describe("share card colors", () => {
	it("match the palette tokens they stand in for", async () => {
		expect(COLORS.ground).toBe(await token("concrete-100"));
		expect(COLORS.ink).toBe(await token("evergreen-800"));
		expect(COLORS.muted).toBe(await token("concrete-600"));
		expect(COLORS.bands).toEqual([
			await token("evergreen-800"),
			await token("evergreen-600"),
			await token("evergreen-400"),
		]);
	});
});

describe("share card type", () => {
	it("reads the site's sans features from the token", async () => {
		const css = await readFile("src/styles/theme.css", "utf8");
		for (const feature of await sansFeatures()) {
			expect(css).toMatch(
				new RegExp(`--font-sans--font-feature-settings:[^;]*"${feature}"`),
			);
		}
	});

	it("sets the two-story a the site uses", async () => {
		const { sans } = await loadFaces();
		const plain = { ...sans, features: [] };
		const [siteA] = shapeLine(sans, "a", 100).glyphs;
		const [defaultA] = shapeLine(plain, "a", 100).glyphs;
		expect(siteA?.id).not.toBe(defaultA?.id);
	});
});

describe("default card", () => {
	it("draws the wedge from the right edge's midpoint to the left third line", async () => {
		const [outer, middle, inner] = paths(await defaultCardSvg());
		expect(outer).toBe("M1200 315L400 630H1200Z");
		expect(middle).toBe("M1200 420L666.67 630H1200Z");
		expect(inner).toBe("M1200 525L933.33 630H1200Z");
	});

	it("starts the name and tagline on one left edge, measured to the letters", async () => {
		const [, , , name = "", tagline = ""] = paths(await defaultCardSvg());
		expect(box(name).left).toBeCloseTo(96, 0);
		expect(box(tagline).left).toBeCloseTo(96, 0);
	});
});

describe("article card", () => {
	it("keeps a short title at 96px, capitals 64px from the top", async () => {
		// Flat-topped capitals: pointed ones, like N, rise a little above the cap height by design.
		const { svg, fit } = await articleCardSvg({ title: "THE EDIT" });
		expect(fit).toMatchObject({ size: 96, lines: ["THE EDIT"] });
		const [, , , title = ""] = paths(svg);
		expect(box(title).top).toBeCloseTo(ARTICLE.margin, 0);
		expect(box(title).left).toBeGreaterThanOrEqual(ARTICLE.margin);
	});

	it("steps a long title down and keeps every word", async () => {
		const title =
			"A very long title steps down to its smallest size and keeps every word, balancing its lines so that none runs long over a short one";
		const { fit } = await articleCardSvg({ title });
		expect(fit.size).toBe(64);
		expect(fit.lines.join(" ")).toBe(title);
	});

	it("cuts only a title the card can't hold, at a word", async () => {
		const { fit } = await articleCardSvg({
			title:
				"Titles this long are rare, so the card handles them plainly. The subtitle gives up its second line, then the title stops at the last word that fits and ends in an ellipsis, as this one does",
			subtitle:
				"This subtitle would take two lines, so it keeps one and ends at a word",
		});
		expect(fit.size).toBe(64);
		expect(fit.subtitleLines).toHaveLength(1);
		expect(fit.lines.at(-1)).toMatch(/\w…$/);
	});

	it("hangs the byline from the bottom-right margins", async () => {
		const { svg } = await articleCardSvg({ title: "On restraint" });
		const [name = "", tagline = ""] = paths(svg).slice(-2);
		expect(box(name).right).toBeLessThanOrEqual(CARD.width - ARTICLE.margin);
		expect(box(name).right).toBeGreaterThan(CARD.width - ARTICLE.margin - 4);
		// The tagline's descender dips below the margin; its capitals end on the baseline.
		expect(box(tagline).bottom).toBeGreaterThan(CARD.height - ARTICLE.margin);
	});

	it("rasterizes to a 1200 × 630 PNG", async () => {
		const { svg } = await articleCardSvg({ title: "On restraint" });
		const { width, height, format } = await sharp(await toPng(svg)).metadata();
		expect({ width, height, format }).toEqual({
			width: 1200,
			height: 630,
			format: "png",
		});
	});
});
