import type { ShikiConfig } from "astro";
import theme from "../styles/shiki-theme.json";

/** Shiki theme whose colors are the design system's `--color-syntax-*` tokens. */
export const syntaxTheme = theme as NonNullable<ShikiConfig["theme"]>;

/**
 * Shiki writes `fontStyle: bold` as `font-weight:bold` (700); the system sets
 * keywords at 600.
 */
export const syntaxTransformers: NonNullable<ShikiConfig["transformers"]> = [
	{
		name: "dn:keyword-weight",
		postprocess: (html) =>
			html.replaceAll("font-weight:bold", "font-weight:600"),
	},
];
