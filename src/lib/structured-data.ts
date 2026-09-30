import Validator from "@adobe/structured-data-validator";
import WebAutoExtractor from "@marbec/web-auto-extractor";
import {
	checkSiteRules,
	type StructuredDataIssue,
} from "./structured-data-rules.ts";

export type { StructuredDataIssue };

/**
 * Validates one page's structured data (JSON-LD, Microdata, RDFa): against
 * the schema.org vocabulary with `@adobe/structured-data-validator`, and
 * against this site's own required-field rules with `checkSiteRules` (see
 * `structured-data-rules.ts`). `schemaOrgJson` is the vocabulary graph from
 * `schemaorg-all-https.jsonld`, loaded by `scripts/validate-structured-data.ts`.
 *
 * Not a pure function despite taking its input as a parameter:
 * `@adobe/structured-data-validator`'s schema.org handler caches whichever
 * vocabulary it sees *first* in a process-wide `static` field, and reuses it
 * for every later call regardless of what's passed in. That's harmless here
 * because every caller in this codebase — the script and its tests — uses
 * the same pinned vocabulary; validating against two different vocabularies
 * in one process would silently validate the second against the first's.
 */
export async function validatePage(
	html: string,
	page: string,
	schemaOrgJson: unknown,
): Promise<StructuredDataIssue[]> {
	const extracted = new WebAutoExtractor({ addLocation: true }).parse(html);
	const adobeIssues = await new Validator(schemaOrgJson).validate(extracted);
	return [
		...adobeIssues.map((issue) => ({
			page,
			dataFormat: issue.dataFormat,
			rootType: issue.rootType,
			severity: issue.severity,
			issueMessage: issue.issueMessage,
			...(issue.fieldNames ? { fieldNames: issue.fieldNames } : {}),
		})),
		...checkSiteRules(extracted.jsonld, page),
	];
}

/**
 * Whether any issue should fail the structured-data gate. Both severities
 * do: the site has no WARNINGs today, so one appearing (e.g. an
 * unrecognized property) is exactly the kind of regression this check
 * exists to catch, not something to wave through.
 */
export function hasBlockingIssues(
	issues: readonly StructuredDataIssue[],
): boolean {
	return issues.some(
		(issue) => issue.severity === "ERROR" || issue.severity === "WARNING",
	);
}
