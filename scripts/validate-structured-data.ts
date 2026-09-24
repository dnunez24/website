/**
 * Validates the structured data (JSON-LD, Microdata, RDFa) on every built
 * page against the schema.org vocabulary, using Adobe's
 * structured-data-validator. Run after `pnpm build`:
 *
 *   pnpm validate:structured-data
 *
 * Requires Node >= 22.18, which runs TypeScript without a build step.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type StructuredDataIssue,
	validatePage,
} from "../src/lib/structured-data.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = join(ROOT, "dist");
const CACHE_DIR = join(ROOT, "node_modules/.cache/schema-org");

// Pinned rather than "latest" so a run is reproducible and doesn't depend on
// schema.org being reachable. Bump deliberately, and update the cache key in
// `.github/workflows/ci.yml` (job `structured-data`) alongside it.
const SCHEMA_ORG_VERSION = "30.1";
const SCHEMA_ORG_URL = `https://schema.org/version/${SCHEMA_ORG_VERSION}/schemaorg-all-https.jsonld`;

/** Fetches the schema.org vocabulary graph, caching it on disk by version. */
async function loadSchemaOrgVocabulary(): Promise<unknown> {
	const cached = join(CACHE_DIR, `schemaorg-${SCHEMA_ORG_VERSION}.jsonld`);

	try {
		return JSON.parse(await readFile(cached, "utf8"));
	} catch {
		// Not cached yet.
	}

	console.log(`fetching ${SCHEMA_ORG_URL}`);
	const response = await fetch(SCHEMA_ORG_URL);
	if (!response.ok) {
		throw new Error(
			`GET ${SCHEMA_ORG_URL} failed: ${response.status} ${response.statusText}`,
		);
	}

	const body = await response.text();
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(cached, body);
	return JSON.parse(body);
}

/** `dist/about/index.html` -> `/about/`; `dist/index.html` -> `/`; `dist/404.html` -> `/404.html`. */
function pagePath(file: string): string {
	const path = relative(DIST_DIR, file).split(sep).join("/");
	return `/${path.replace(/index\.html$/, "")}`;
}

async function findHtmlFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, {
		withFileTypes: true,
		recursive: true,
	});
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

const schemaOrgJson = await loadSchemaOrgVocabulary();
const files = await findHtmlFiles(DIST_DIR);
if (files.length === 0) {
	throw new Error(
		`No HTML files in ${relative(ROOT, DIST_DIR)}. Run \`pnpm build\` first.`,
	);
}

const issues: StructuredDataIssue[] = [];
for (const file of files) {
	const html = await readFile(file, "utf8");
	issues.push(...(await validatePage(html, pagePath(file), schemaOrgJson)));
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

if (errors.length > 0) {
	process.exitCode = 1;
}
