/**
 * Checks every built page for accessibility violations with axe-core, at
 * mobile and desktop widths. Run after `pnpm build`:
 *
 *   pnpm test:a11y
 *
 * Requires Node >= 22.18, which runs TypeScript without a build step.
 */

import { createReadStream } from "node:fs";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
	type A11yPageResult,
	checkPageAccessibility,
} from "../src/lib/a11y.ts";
import { findHtmlFiles, pagePath } from "../src/lib/dist-pages.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = join(ROOT, "dist");
const REPORT_PATH = join(ROOT, "reports/a11y/report.json");

// height is fixed; only width varies between a phone and a laptop layout.
const WIDTHS = [320, 1024];
const HEIGHT = 800;

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
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

type Resolved =
	| { kind: "file"; path: string }
	| { kind: "redirect"; to: string }
	| { kind: "not-found" };

function withinDist(candidate: string): boolean {
	return candidate === DIST_DIR || (candidate + sep).startsWith(DIST_DIR + sep);
}

/**
 * Maps a URL path to a file under `dist/`, the way Workers serves static
 * assets: `/x/` resolves to `/x/index.html`, and a directory requested
 * without its trailing slash (`/x`) redirects to `/x/` rather than being
 * read as a file (which throws EISDIR).
 */
async function resolve(urlPath: string): Promise<Resolved> {
	if (urlPath.endsWith("/")) {
		const filePath = join(DIST_DIR, `${urlPath}index.html`);
		if (!withinDist(filePath)) return { kind: "not-found" };
		try {
			if ((await stat(filePath)).isFile()) {
				return { kind: "file", path: filePath };
			}
		} catch {
			// Not found.
		}
		return { kind: "not-found" };
	}

	const candidate = join(DIST_DIR, urlPath);
	if (!withinDist(candidate)) return { kind: "not-found" };
	try {
		const info = await stat(candidate);
		if (info.isFile()) return { kind: "file", path: candidate };
		if (info.isDirectory()) return { kind: "redirect", to: `${urlPath}/` };
	} catch {
		// Not found.
	}
	return { kind: "not-found" };
}

async function handleRequest(
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	let urlPath: string;
	try {
		urlPath = decodeURIComponent(
			new URL(req.url ?? "/", "http://localhost").pathname,
		);
	} catch {
		// A malformed percent-escape (e.g. a truncated UTF-8 sequence) throws.
		res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
		res.end("Bad request: malformed URL");
		return;
	}

	const result = await resolve(urlPath);
	if (result.kind === "file") {
		res.writeHead(200, {
			"Content-Type":
				CONTENT_TYPES[extname(result.path)] ?? "application/octet-stream",
		});
		createReadStream(result.path).pipe(res);
		return;
	}
	if (result.kind === "redirect") {
		res.writeHead(301, { Location: result.to });
		res.end();
		return;
	}

	const notFound = await resolve("/404.html");
	res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
	if (notFound.kind === "file") {
		createReadStream(notFound.path).pipe(res);
	} else {
		res.end("Not found");
	}
}

/** Serves `dist/` on a free port, the way Workers will. */
function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
	const server = createServer((req, res) => {
		// However a request fails — a bad URL, a bad path, a bug in resolve()
		// — the server must respond, not let an unhandled rejection crash
		// the whole run.
		handleRequest(req, res).catch((error: unknown) => {
			console.error("check-a11y static server error:", error);
			if (!res.headersSent) {
				res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
			}
			res.end("Internal error");
		});
	});

	return new Promise((resolvePromise) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				throw new Error("Static server has no port");
			}
			resolvePromise({
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

const allFiles = await findHtmlFiles(DIST_DIR);
if (allFiles.length === 0) {
	throw new Error(
		`No HTML files in ${relative(ROOT, DIST_DIR)}. Run \`pnpm build\` first.`,
	);
}

// This checker never visits the 404 page by its own name, even though the
// server (like Workers) would happily serve it there too, with 200, same as
// any other file. A real broken link lands on it via an unmatched path, at
// a 404 status, so that's how it's checked too: once, not as an ordinary
// 200 page in the main list (which would check the same markup twice and,
// once dist/404.html is a real page, immediately fail on "/404.html
// responded 200, expected 404").
const NOT_FOUND_FILE = join(DIST_DIR, "404.html");
const hasNotFoundPage = allFiles.includes(NOT_FOUND_FILE);
const NOT_FOUND_PROBE_PATH = "/__a11y-not-found__/";
const files = allFiles.filter((file) => file !== NOT_FOUND_FILE);
const plannedChecks =
	(files.length + (hasNotFoundPage ? 1 : 0)) * WIDTHS.length;

const server = await startServer();
const browser = await chromium.launch({ timeout: 60_000 });
// An explicit context, not the browser.newPage() shorthand: axe-core's own
// "finish" step opens a second page in the same context, which Playwright
// refuses on the shorthand's implicit single-page context.
const context = await browser.newContext();
const page = await context.newPage();

const results: A11yPageResult[] = [];
let crawlError: unknown;
try {
	for (const file of files) {
		const path = pagePath(DIST_DIR, file);
		for (const width of WIDTHS) {
			const result = await checkPageAccessibility({
				page,
				url: server.url + path,
				label: path,
				width,
				height: HEIGHT,
			});
			results.push(result);
			printResult(result);
		}
	}
	if (hasNotFoundPage) {
		for (const width of WIDTHS) {
			const result = await checkPageAccessibility({
				page,
				url: server.url + NOT_FOUND_PROBE_PATH,
				label: "/404.html",
				width,
				height: HEIGHT,
				expectedStatus: 404,
			});
			results.push(result);
			printResult(result);
		}
	}
} catch (error) {
	crawlError = error;
} finally {
	await browser.close();
	await server.close();
}

const violationCount = results.reduce((sum, r) => sum + r.violations.length, 0);
const incompleteCount = results.reduce(
	(sum, r) => sum + r.incomplete.length,
	0,
);

// Written even when the crawl threw partway through, so a run that fails on
// page 5 doesn't also lose the report for pages 1-4.
await mkdir(join(ROOT, "reports/a11y"), { recursive: true });
await writeFile(
	REPORT_PATH,
	JSON.stringify(
		{
			generatedAt: new Date().toISOString(),
			widths: WIDTHS,
			height: HEIGHT,
			pagesPlanned: files.length + (hasNotFoundPage ? 1 : 0),
			checksRecorded: results.length,
			complete: crawlError === undefined,
			...(crawlError
				? {
						error:
							crawlError instanceof Error
								? crawlError.message
								: String(crawlError),
					}
				: {}),
			violationCount,
			incompleteCount,
			results,
		},
		null,
		2,
	),
);

console.log(
	`\n${results.length} check${results.length === 1 ? "" : "s"} recorded ` +
		`(of ${plannedChecks} planned at ${WIDTHS.join("px, ")}px), ` +
		`${violationCount} violation${violationCount === 1 ? "" : "s"}, ` +
		`${incompleteCount} needing manual review.`,
);
console.log(`Report: ${relative(ROOT, REPORT_PATH)}`);

if (crawlError) {
	throw crawlError;
}
if (violationCount > 0) {
	process.exitCode = 1;
}
