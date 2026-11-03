/**
 * Fails if any built page ships a <script> (besides JSON-LD and the
 * sanctioned Cloudflare beacon) or an inline `on*` event handler — the
 * things `resource-summary:script:size` in lighthouserc.cjs can't see,
 * since that budget only counts network requests. Run after `pnpm build`:
 *
 *   pnpm test:no-js
 *
 * Requires Node >= 22.18, which runs TypeScript without a build step.
 */

import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findHtmlFiles, pagePath } from "../src/lib/dist-pages.ts";
import { checkPageForScripts, type NoJsIssue } from "../src/lib/no-js.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = join(ROOT, "dist");

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

const issues: NoJsIssue[] = [];
for (const file of files) {
	const html = await readFile(file, "utf8");
	issues.push(...checkPageForScripts(html, pagePath(DIST_DIR, file)));
}

for (const issue of issues) {
	console.error(`${issue.page}  ${issue.message}`);
}

console.log(
	`\n${files.length} page${files.length === 1 ? "" : "s"} checked, ` +
		`${issues.length} issue${issues.length === 1 ? "" : "s"}.`,
);

if (issues.length > 0) {
	process.exitCode = 1;
}
