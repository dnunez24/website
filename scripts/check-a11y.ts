/**
 * Checks every built page for accessibility violations with axe-core, at
 * mobile and desktop widths. Run after `pnpm build`:
 *
 *   pnpm test:a11y
 *
 * Requires Node >= 22.18, which runs TypeScript without a build step.
 */

import { createReadStream } from "node:fs";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
	type A11yPageResult,
	checkPageAccessibility,
} from "../src/lib/a11y.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = join(ROOT, "dist");
const REPORT_PATH = join(ROOT, "reports/a11y/report.json");

// height is fixed; only width varies between a phone and a laptop layout.
const WIDTHS = [320, 1024];
const HEIGHT = 800;

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".woff2": "font/woff2",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".xml": "application/xml",
	".json": "application/json",
};

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

/** `dist/about/index.html` -> `/about/`; `dist/index.html` -> `/`; `dist/404.html` -> `/404.html`. */
function pagePath(file: string): string {
	const path = relative(DIST_DIR, file).split(sep).join("/");
	return `/${path.replace(/index\.html$/, "")}`;
}

/** Maps a URL path to a file under `dist/`, adding `index.html` for a directory-style path. */
async function resolveFile(urlPath: string): Promise<string | undefined> {
	const candidate = join(
		DIST_DIR,
		urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath,
	);
	if (!(candidate + sep).startsWith(DIST_DIR + sep) && candidate !== DIST_DIR) {
		return undefined; // outside dist/, e.g. via "../"
	}
	try {
		await access(candidate);
		return candidate;
	} catch {
		return undefined;
	}
}

/**
 * Serves `dist/` as a static site the way Workers will: `/x/` resolves to
 * `/x/index.html`, and any path with no matching file gets `404.html`'s
 * markup back with a 404 status, rather than a bare Node error page.
 */
function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
	const server = createServer((req, res) => {
		void (async () => {
			const urlPath = decodeURIComponent(
				new URL(req.url ?? "/", "http://localhost").pathname,
			);
			const file = await resolveFile(urlPath);
			if (file) {
				res.writeHead(200, {
					"Content-Type":
						CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
				});
				createReadStream(file).pipe(res);
				return;
			}

			const notFound = await resolveFile("/404.html");
			res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
			if (notFound) {
				createReadStream(notFound).pipe(res);
			} else {
				res.end("Not found");
			}
		})();
	});

	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				throw new Error("Static server has no port");
			}
			resolve({
				url: `http://127.0.0.1:${address.port}`,
				close: () => new Promise((res) => server.close(() => res())),
			});
		});
	});
}

function printResult(result: A11yPageResult): void {
	for (const violation of result.violations) {
		for (const node of violation.nodes) {
			console.error(
				`violation  ${result.url}  ${result.width}px  [${violation.id}] ${violation.help} — ${node.target.join(" ")}`,
			);
		}
	}
	for (const incomplete of result.incomplete) {
		for (const node of incomplete.nodes) {
			console.warn(
				`review     ${result.url}  ${result.width}px  [${incomplete.id}] ${incomplete.help} — ${node.target.join(" ")}`,
			);
		}
	}
}

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

const server = await startServer();
const browser = await chromium.launch();
// An explicit context, not the browser.newPage() shorthand: axe-core's own
// "finish" step opens a second page in the same context, which Playwright
// refuses on the shorthand's implicit single-page context.
const context = await browser.newContext();
const page = await context.newPage();

const results: A11yPageResult[] = [];
try {
	for (const file of files) {
		const path = pagePath(file);
		for (const width of WIDTHS) {
			await page.goto(server.url + path);
			const result = await checkPageAccessibility(page, path, width, HEIGHT);
			results.push(result);
			printResult(result);
		}
	}
} finally {
	await browser.close();
	await server.close();
}

const violationCount = results.reduce((sum, r) => sum + r.violations.length, 0);
const incompleteCount = results.reduce(
	(sum, r) => sum + r.incomplete.length,
	0,
);

await mkdir(join(ROOT, "reports/a11y"), { recursive: true });
await writeFile(
	REPORT_PATH,
	JSON.stringify(
		{
			generatedAt: new Date().toISOString(),
			widths: WIDTHS,
			height: HEIGHT,
			pagesChecked: files.length,
			violationCount,
			incompleteCount,
			results,
		},
		null,
		2,
	),
);

console.log(
	`\n${files.length} page${files.length === 1 ? "" : "s"} checked at ${WIDTHS.join("px, ")}px, ` +
		`${violationCount} violation${violationCount === 1 ? "" : "s"}, ` +
		`${incompleteCount} needing manual review.`,
);
console.log(`Report: ${relative(ROOT, REPORT_PATH)}`);

if (violationCount > 0) {
	process.exitCode = 1;
}
