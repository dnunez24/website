/**
 * Typings for `@adobe/structured-data-validator`, which ships none. Mirrors
 * `Validator#validate`, which spreads each handler's issue onto
 * `{rootType, dataFormat, location, source}`; see
 * https://github.com/adobe/structured-data-validator.
 */
declare module "@adobe/structured-data-validator" {
	import type { ExtractedData } from "@marbec/web-auto-extractor";

	export interface ValidationIssue {
		rootType: string;
		dataFormat: "jsonld" | "microdata" | "rdfa";
		issueMessage: string;
		severity: "ERROR" | "WARNING";
		/** Comma-separated source offsets, e.g. `"35,100"`; absent for some WAE errors. */
		location?: string;
		source?: string;
		path?: unknown[];
		fieldNames?: string[];
	}

	export default class Validator {
		constructor(schemaOrgJson: unknown);
		/** Logs each type and issue as it validates. Off by default. */
		debug: boolean;
		validate(waeData: ExtractedData): Promise<ValidationIssue[]>;
	}
}
