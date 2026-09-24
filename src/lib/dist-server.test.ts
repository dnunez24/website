import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DistServerHandle, startDistServer } from "./dist-server";

/**
 * A raw request line, bypassing both `fetch()` and the `URL` constructor:
 * both normalize a literal ".." out of a path before it would ever reach the
 * server, which would hide whether the server's own traversal guard
 * (`withinDist`) does anything.
 */
function rawStatusLine(port: number, requestTarget: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const socket = connect(port, "127.0.0.1", () => {
			socket.write(
				`GET ${requestTarget} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`,
			);
		});
		let data = "";
		socket.on("data", (chunk) => {
			data += chunk;
		});
		socket.on("end", () => resolve(data.split("\r\n")[0] ?? ""));
		socket.on("error", reject);
	});
}

let parentDir: string;
let distDir: string;
let server: DistServerHandle;

beforeAll(async () => {
	// distDir is nested inside parentDir (as the real dist/ sits under the
	// repo root next to package.json), so a traversal escape has a real,
	// identifiable file one level up to reach.
	parentDir = await mkdtemp(join(tmpdir(), "dist-server-test-"));
	distDir = join(parentDir, "dist");
	await mkdir(join(distDir, "about"), { recursive: true });
	await writeFile(
		join(parentDir, "package.json"),
		'{"name":"should-not-be-reachable"}',
	);
	await writeFile(
		join(distDir, "index.html"),
		"<!doctype html><title>Home</title>",
	);
	await writeFile(
		join(distDir, "about", "index.html"),
		"<!doctype html><title>About</title>",
	);
	await writeFile(
		join(distDir, "404.html"),
		"<!doctype html><title>Not found</title>",
	);
	await writeFile(join(distDir, "style.css"), "body { color: red; }");
	await writeFile(join(distDir, "script.js"), "console.log(1);");

	server = await startDistServer(distDir, 0);
});

afterAll(async () => {
	await server.close();
	await rm(parentDir, { recursive: true, force: true });
});

describe("startDistServer", () => {
	it("serves a directory-style path as its index.html", async () => {
		const response = await fetch(`${server.url}/about/`);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("<title>About</title>");
	});

	it("redirects a directory requested without its trailing slash", async () => {
		const response = await fetch(`${server.url}/about`, { redirect: "manual" });
		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe("/about/");
	});

	it("serves 404.html's markup at a 404 status for an unmatched path", async () => {
		const response = await fetch(`${server.url}/does-not-exist/`);
		expect(response.status).toBe(404);
		expect(await response.text()).toContain("<title>Not found</title>");
	});

	it("still answers 404 for an unmatched path when there's no 404.html", async () => {
		const bareDir = await mkdtemp(join(tmpdir(), "dist-server-test-bare-"));
		await writeFile(
			join(bareDir, "index.html"),
			"<!doctype html><title>Home</title>",
		);
		const bareServer = await startDistServer(bareDir, 0);
		try {
			const response = await fetch(`${bareServer.url}/does-not-exist/`);
			expect(response.status).toBe(404);
		} finally {
			await bareServer.close();
			await rm(bareDir, { recursive: true, force: true });
		}
	});

	it("returns 400 for a malformed percent-escape instead of throwing", async () => {
		const response = await fetch(`${server.url}/%E0%A4%A`);
		expect(response.status).toBe(400);
	});

	it("stays inside distDir against a literal path-traversal request", async () => {
		const port = Number(new URL(server.url).port);
		const status = await rawStatusLine(port, "/../../../etc/passwd");
		expect(status).toBe("HTTP/1.1 404 Not Found");
	});

	it("stays inside distDir against a %2f-encoded traversal escape", async () => {
		// A regression case, not just another traversal check: the URL
		// constructor normalizes a literal ".." out of a path before this
		// server ever sees it (proven by the raw-socket test above, which is
		// the only reason that one needs a raw socket at all) — but it does
		// NOT decode %2f first, so "..%2fpackage.json" reaches resolve() as
		// "..%2fpackage.json", survives that normalization untouched, and
		// only becomes "../package.json" *after* this server's own
		// decodeURIComponent(). Without the withinDist() guard, this
		// actually escapes distDir and returns parentDir/package.json.
		const response = await fetch(`${server.url}/..%2fpackage.json`);
		expect(response.status).toBe(404);
	});

	it("serves each file with its matching content type", async () => {
		const html = await fetch(`${server.url}/`);
		expect(html.headers.get("content-type")).toContain("text/html");

		const css = await fetch(`${server.url}/style.css`);
		expect(css.headers.get("content-type")).toContain("text/css");

		const js = await fetch(`${server.url}/script.js`);
		expect(js.headers.get("content-type")).toContain("text/javascript");
	});
});
