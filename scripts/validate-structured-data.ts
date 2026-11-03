/**
 * Validates the structured data (JSON-LD, Microdata, RDFa) on every built
 * page against the schema.org vocabulary and this site's own required-field
 * rules (see `src/lib/structured-data-rules.ts`). Run after `pnpm build`:
 *
 *   pnpm validate:structured-data
 *
 * Requires Node >= 22.18, which runs TypeScript without a build step.
 */

import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { findHtmlFiles, pagePath } from "../src/lib/dist-pages.ts";
import {
	hasBlockingIssues,
	type StructuredDataIssue,
	validatePage,
} from "../src/lib/structured-data.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = join(ROOT, "dist");

// The schema.org vocabulary is vendored rather than fetched: CI has no
// network dependency on schema.org, and there's no cold-cache request,
// timeout, or retry to get right. From https://schema.org/version/30.1/
// schemaorg-all-https.jsonld (CC BY-SA 3.0; see README.md's Credit section).
// Bump deliberately — replace the file in scripts/vendor/ and this path.
const VOCABULARY_PATH = join(ROOT, "scripts/vendor/schemaorg-30.1.jsonld.gz");

async function loadSchemaOrgVocabulary(): Promise<unknown> {
	const gzipped = await readFile(VOCABULARY_PATH);
	return JSON.parse(gunzipSync(gzipped).toString("utf8"));
}

// Fail fast and readably if `pnpm build` hasn't run, before loading the
// vocabulary or anything else.
try {
	await access(DIST_DIR);
} catch {
	throw new Error(
		`No ${relative(ROOT, DIST_DIR)} directory. Run \`pnpm build\` first.`,
	);
}

const files = await findHtmlFiles(DIST_DIR);
if (files.length === 0) {
	throw new Error(
		`No HTML files in ${relative(ROOT, DIST_DIR)}. Run \`pnpm build\` first.`,
	);
}

const schemaOrgJson = await loadSchemaOrgVocabulary();

const issues: StructuredDataIssue[] = [];
for (const file of files) {
	const html = await readFile(file, "utf8");
	issues.push(
		...(await validatePage(html, pagePath(DIST_DIR, file), schemaOrgJson)),
	);
}

const errors = issues.filter((issue) => issue.severity === "ERROR");
const warnings = issues.filter((issue) => issue.severity === "WARNING");

for (const issue of errors) {
	const fields = issue.fieldNames ? ` (${issue.fieldNames.join(", ")})` : "";
	console.error(
		`error    ${issue.page}  [${issue.dataFormat}/${issue.rootType}] ${issue.issueMessage}${fields}`,
	);
}
for (const issue of warnings) {
	const fields = issue.fieldNames ? ` (${issue.fieldNames.join(", ")})` : "";
	console.warn(
		`warning  ${issue.page}  [${issue.dataFormat}/${issue.rootType}] ${issue.issueMessage}${fields}`,
	);
}

console.log(
	`\n${files.length} page${files.length === 1 ? "" : "s"} checked, ` +
		`${errors.length} error${errors.length === 1 ? "" : "s"}, ` +
		`${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`,
);

if (hasBlockingIssues(issues)) {
	process.exitCode = 1;
}
