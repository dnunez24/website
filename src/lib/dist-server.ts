import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { extname, join, sep } from "node:path";

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

export interface DistServerHandle {
	url: string;
	close: () => Promise<void>;
}

function withinDist(distDir: string, candidate: string): boolean {
	return candidate === distDir || (candidate + sep).startsWith(distDir + sep);
}

/**
 * Maps a URL path to a file under `distDir`, the way Workers serves static
 * assets: `/x/` resolves to `/x/index.html`, and a directory requested
 * without its trailing slash (`/x`) redirects to `/x/` rather than being
 * read as a file (which throws EISDIR).
 */
async function resolve(distDir: string, urlPath: string): Promise<Resolved> {
	if (urlPath.endsWith("/")) {
		const filePath = join(distDir, `${urlPath}index.html`);
		if (!withinDist(distDir, filePath)) return { kind: "not-found" };
		try {
			if ((await stat(filePath)).isFile()) {
				return { kind: "file", path: filePath };
			}
		} catch {
			// Not found.
		}
		return { kind: "not-found" };
	}

	const candidate = join(distDir, urlPath);
	if (!withinDist(distDir, candidate)) return { kind: "not-found" };
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
	distDir: string,
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

	const result = await resolve(distDir, urlPath);
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

	const notFound = await resolve(distDir, "/404.html");
	res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
	if (notFound.kind === "file") {
		createReadStream(notFound.path).pipe(res);
	} else {
		res.end("Not found");
	}
}

/**
 * Serves `distDir` as a static site the way Workers will — used by both
 * `check-a11y.ts` (its own ephemeral instance) and `serve-dist.ts` (a
 * long-lived one for Lighthouse CI to point at), so both check the site as
 * it will actually be served, not as `astro preview` or LHCI's own static
 * server would serve it.
 */
export function startDistServer(
	distDir: string,
	port = 0,
): Promise<DistServerHandle> {
	const server = createServer((req, res) => {
		// However a request fails — a bad URL, a bad path, a bug in resolve()
		// — the server must respond, not let an unhandled rejection crash
		// the whole run.
		handleRequest(distDir, req, res).catch((error: unknown) => {
			console.error("dist server error:", error);
			if (!res.headersSent) {
				res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
			}
			res.end("Internal error");
		});
	});

	return new Promise((resolvePromise, rejectPromise) => {
		server.on("error", rejectPromise);
		server.listen(port, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				rejectPromise(new Error("Static server has no port"));
				return;
			}
			resolvePromise({
				url: `http://127.0.0.1:${address.port}`,
				close: () => new Promise((res) => server.close(() => res())),
			});
		});
	});
}
