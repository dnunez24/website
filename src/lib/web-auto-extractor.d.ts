/**
 * Typings for `@marbec/web-auto-extractor`, which ships none. Mirrors
 * `parse()`'s output, built by merging its jsonld/microdata/rdfa/metatag/
 * heading parsers; see https://github.com/herzog31/web-auto-extractor.
 */
declare module "@marbec/web-auto-extractor" {
	export interface WebAutoExtractorOptions {
		/** Add each root item's source offsets, as `"<start>,<end>"`, in `@location`. */
		addLocation?: boolean;
		/** Embed the matched markup in `@source`: `true` for every format, or a list of formats. */
		embedSource?: boolean | ("jsonld" | "microdata" | "rdfa")[];
		skipEmptyHeadings?: boolean;
		skipLayoutElements?: boolean;
	}

	/** A parsed structured-data node, grouped by `@type` under its format. */
	export interface ExtractedNode {
		"@type"?: string | string[];
		"@location"?: string;
		"@source"?: string;
		[property: string]: unknown;
	}

	export interface ExtractedParseError {
		message: string;
		format: "jsonld" | "microdata" | "rdfa";
		source?: string;
		sourceCodeLocation?: { startOffset: number; endOffset: number };
	}

	export interface ExtractedData {
		metatags: Record<string, unknown>;
		microdata: Record<string, ExtractedNode[]>;
		rdfa: Record<string, ExtractedNode[]>;
		jsonld: Record<string, ExtractedNode[]>;
		headings: Record<string, unknown>;
		errors: ExtractedParseError[];
	}

	export default class WebAutoExtractor {
		constructor(options?: WebAutoExtractorOptions);
		parse(html: string): ExtractedData;
	}
}
