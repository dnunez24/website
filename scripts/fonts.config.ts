/**
 * Inputs for `scripts/build-fonts.ts`.
 *
 * Google Fonts and Fontsource both serve webfonts subset with harfbuzz's
 * default layout-feature list, which drops stylistic sets and other
 * discretionary features. Afacad Flux loses `aalt`, `case`, `dlig`, `ordn`,
 * `sinf`, `ss01`–`ss04`, `subs`, `sups` and `zero` that way, so anything
 * naming them in `font-feature-settings` silently does nothing. We rebuild
 * from the upstream source instead.
 *
 * `SUBSETS` is imported by `astro.config.ts` so the `unicode-range`
 * descriptors can never drift from what the files actually contain.
 */

/** At least one range, matching the shape Astro wants for `unicodeRange`. */
type UnicodeRanges = [string, ...string[]];

/** Unicode ranges, verbatim from the Google Fonts CSS API. */
export const SUBSETS = {
	latin: [
		"U+0000-00FF",
		"U+0131",
		"U+0152-0153",
		"U+02BB-02BC",
		"U+02C6",
		"U+02DA",
		"U+02DC",
		"U+0304",
		"U+0308",
		"U+0329",
		"U+2000-206F",
		"U+20AC",
		"U+2122",
		"U+2191",
		"U+2193",
		"U+2212",
		"U+2215",
		"U+FEFF",
		"U+FFFD",
	],
	"latin-ext": [
		"U+0100-02BA",
		"U+02BD-02C5",
		"U+02C7-02CC",
		"U+02CE-02D7",
		"U+02DD-02FF",
		"U+0304",
		"U+0308",
		"U+0329",
		"U+1D00-1DBF",
		"U+1E00-1E9F",
		"U+1EF2-1EFF",
		"U+2020",
		"U+20A0-20AB",
		"U+20AD-20C0",
		"U+2113",
		"U+2C60-2C7F",
		"U+A720-A7FF",
	],
	vietnamese: [
		"U+0102-0103",
		"U+0110-0111",
		"U+0128-0129",
		"U+0168-0169",
		"U+01A0-01A1",
		"U+01AF-01B0",
		"U+0300-0301",
		"U+0303-0304",
		"U+0308-0309",
		"U+0323",
		"U+0329",
		"U+1EA0-1EF9",
		"U+20AB",
	],
} satisfies Record<string, UnicodeRanges>;

export type SubsetName = keyof typeof SUBSETS;

/** A variation axis pinned to one value, or narrowed to a range. */
export type AxisRange = number | { min: number; max: number; default?: number };

export interface FontVariant {
	/** File-name segment: an axis tag for variable output, a number for static. */
	label: string;
	/** `font-weight` descriptor for the `@font-face` rule in `astro.config.ts`. */
	weight: string;
	style: "normal" | "italic";
	/** Axes to pin or narrow. Omitted axes keep their full upstream range. */
	axes?: Record<string, AxisRange>;
}

export interface FontBuild {
	family: string;
	/** File-name stem, also the `--only=` key. */
	stem: string;
	/** Upstream, unsubset source. */
	source: string;
	/** Copied next to the fonts; required when redistributing OFL faces. */
	license?: string;
	subsets: SubsetName[];
	/**
	 * OpenType feature tags to retain. The list covers GPOS as well as GSUB, so
	 * it has to include `kern`, `mark` and `mkmk` or the font loses kerning and
	 * mark positioning. Tags the source lacks are reported and skipped. Omit
	 * the field to keep every feature the source has, at a cost in file size.
	 */
	features?: string[];
	variants: FontVariant[];
}

/** Without `calt`, so code shows its real characters instead of ligatures. */
const MONO_FEATURES = ["ccmp", "kern", "locl", "mark", "mkmk", "zero"];

export const FONTS: FontBuild[] = [
	{
		family: "Afacad Flux",
		stem: "afacad-flux",
		source:
			"https://raw.githubusercontent.com/google/fonts/main/ofl/afacadflux/AfacadFlux%5Bslnt%2Cwght%5D.ttf",
		license:
			"https://raw.githubusercontent.com/google/fonts/main/ofl/afacadflux/OFL.txt",
		subsets: ["latin"],
		features: [
			"calt",
			"case",
			"ccmp",
			"dnom",
			"frac",
			"kern",
			"liga",
			"locl",
			"mark",
			"mkmk",
			"numr",
			"pnum",
			"ss01",
			"ss02",
			"ss03",
			"ss04",
			"tnum",
			"zero",
		],
		variants: [
			{
				label: "wght",
				weight: "100 1000",
				style: "normal",
				// Italics come from the slant axis at -12; nothing leans left, so
				// the positive half of the axis is dropped.
				axes: { slnt: { min: -12, max: 0, default: 0 } },
			},
		],
	},
	{
		family: "JetBrains Mono",
		stem: "jetbrains-mono",
		source:
			"https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
		license:
			"https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/OFL.txt",
		subsets: ["latin"],
		features: MONO_FEATURES,
		variants: [{ label: "wght", weight: "100 800", style: "normal" }],
	},
	{
		family: "JetBrains Mono",
		stem: "jetbrains-mono-italic",
		source:
			"https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono-Italic%5Bwght%5D.ttf",
		// Same upstream OFL as the "jetbrains-mono" build above, already
		// committed as jetbrains-mono-OFL.txt — omit here so a rebuild
		// doesn't write an untracked duplicate under a different filename.
		subsets: ["latin"],
		features: MONO_FEATURES,
		variants: [{ label: "wght", weight: "100 800", style: "italic" }],
	},
];
