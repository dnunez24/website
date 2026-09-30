import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** Every built HTML page under `distDir`, sorted for deterministic output. */
export async function findHtmlFiles(distDir: string): Promise<string[]> {
	const entries = await readdir(distDir, {
		withFileTypes: true,
		recursive: true,
	});
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

/** `dist/about/index.html` -> `/about/`; `dist/index.html` -> `/`; `dist/404.html` -> `/404.html`. */
export function pagePath(distDir: string, file: string): string {
	const path = relative(distDir, file).split(sep).join("/");
	return `/${path.replace(/index\.html$/, "")}`;
}
