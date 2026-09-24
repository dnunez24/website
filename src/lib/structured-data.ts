import Validator from "@adobe/structured-data-validator";
import WebAutoExtractor from "@marbec/web-auto-extractor";

export interface StructuredDataIssue {
	/** The page the issue is on, e.g. `/writing/first-post/`. */
	page: string;
	dataFormat: "jsonld" | "microdata" | "rdfa";
	rootType: string;
	severity: "ERROR" | "WARNING";
	issueMessage: string;
	fieldNames?: string[];
}

/**
 * Validates one page's structured data (JSON-LD, Microdata, RDFa) against
 * the schema.org vocabulary. `schemaOrgJson` is the vocabulary graph from
 * `schemaorg-all-https.jsonld`, loaded and cached by
 * `scripts/validate-structured-data.ts`; taking it as a parameter keeps this
 * function pure, so tests can pass a small local vocabulary instead of
 * fetching the real ~1000-node graph.
 */
export async function validatePage(
	html: string,
	page: string,
	schemaOrgJson: unknown,
): Promise<StructuredDataIssue[]> {
	const extracted = new WebAutoExtractor({ addLocation: true }).parse(html);
	const issues = await new Validator(schemaOrgJson).validate(extracted);
	return issues.map((issue) => ({
		page,
		dataFormat: issue.dataFormat,
		rootType: issue.rootType,
		severity: issue.severity,
		issueMessage: issue.issueMessage,
		...(issue.fieldNames ? { fieldNames: issue.fieldNames } : {}),
	}));
}
