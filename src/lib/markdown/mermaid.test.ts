import { pathToFileURL } from "node:url";
import { markdownToHtml } from "satteri";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mermaidDiagrams } from "./mermaid";

const named = "```mermaid\nflowchart LR\n  accTitle: Named\n  A --> B\n```\n";
const unnamed = "```mermaid\nflowchart LR\n  A --> B\n```\n";

const fileURLFor = (path: string) => pathToFileURL(`${process.cwd()}/${path}`);
const devPageURL = fileURLFor("src/pages/dev/design-system-markdown.md");

const render = (markdown: string, fileURL: URL) =>
	markdownToHtml(markdown, { hastPlugins: [mermaidDiagrams()], fileURL });

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("mermaidDiagrams", () => {
	// Dev pages used to be skipped in production so the build never launched
	// Chromium. Pele needs no browser, so a dev-page fence renders like any
	// other, and a broken one fails the build the same way.
	it("renders a dev-page fence in a production build", () => {
		vi.stubEnv("PROD", true);
		const { html } = render(named, devPageURL);
		expect(html).toMatch(/^<figure data-diagram[^>]*><svg /);
		expect(html).not.toContain("language-mermaid");
	});

	it("starts an unnamed fence's error with the file's path", () => {
		let message = "";
		try {
			render(unnamed, devPageURL);
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message.startsWith(`${devPageURL.pathname}: `)).toBe(true);
		expect(message).toContain("accTitle or accDescr");
	});
});
