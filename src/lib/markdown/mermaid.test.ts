import { pathToFileURL } from "node:url";
import { markdownToHtml } from "satteri";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderMermaidFigure } from "../mermaid";
import { mermaidDiagrams } from "./mermaid";

// The renderer launches headless Chromium; these tests are about whether
// mermaidDiagrams calls it at all, so it's stubbed rather than run for real.
vi.mock("../mermaid", () => ({
	renderMermaidFigure: vi.fn(async () => "<figure data-diagram>stub</figure>"),
}));

const fence = "```mermaid\nflowchart LR\n  accTitle: Stub\n  A --> B\n```\n";

const fileURLFor = (path: string) => pathToFileURL(`${process.cwd()}/${path}`);
const devPageURL = fileURLFor("src/pages/dev/design-system-markdown.md");
const articleURL = fileURLFor("src/pages/writing/first-post.md");

const render = async (fileURL: URL) => {
	const { html } = await markdownToHtml(fence, {
		hastPlugins: [mermaidDiagrams()],
		fileURL,
	});
	return html;
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.mocked(renderMermaidFigure).mockClear();
});

describe("mermaidDiagrams, in a production build (drops dev pages)", () => {
	it("leaves a dev-page fence as an unrendered pre", async () => {
		vi.stubEnv("PROD", true);
		const html = await render(devPageURL);
		expect(renderMermaidFigure).not.toHaveBeenCalled();
		expect(html).toContain('<pre><code class="language-mermaid">');
	});

	it("still renders a fence outside src/pages/dev/", async () => {
		vi.stubEnv("PROD", true);
		const html = await render(articleURL);
		expect(renderMermaidFigure).toHaveBeenCalledOnce();
		expect(html).toContain("<figure data-diagram>");
	});
});

describe("mermaidDiagrams, outside a production build", () => {
	it("renders a dev-page fence (astro dev and vitest never drop dev pages)", async () => {
		const html = await render(devPageURL);
		expect(renderMermaidFigure).toHaveBeenCalledOnce();
		expect(html).toContain("<figure data-diagram>");
	});
});
