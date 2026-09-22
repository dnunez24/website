/**
 * Typings for `subset-font`, which ships none.
 * Mirrors the API documented at https://github.com/papandreou/subset-font#api.
 */
declare module "subset-font" {
	export type VariationAxis =
		| number
		| { min: number; max: number; default?: number };

	export interface SubsetFontOptions {
		targetFormat?: "sfnt" | "truetype" | "woff" | "woff2";
		preserveNameIds?: number[];
		/** Feature tags to retain; `hb-subset --layout-features`. All by default. */
		keepFeatures?: string[];
		variationAxes?: Record<string, VariationAxis>;
		noLayoutClosure?: boolean;
		glyphNames?: boolean;
		noHinting?: boolean;
		dropTables?: string[];
	}

	export default function subsetFont(
		font: Buffer,
		text: string,
		options?: SubsetFontOptions,
	): Promise<Buffer>;
}
