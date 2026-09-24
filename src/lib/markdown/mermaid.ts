import { defineHastPlugin } from "satteri";
import { renderMermaidFigure } from "../mermaid";
import { dropsDevPages, isDevPageFile } from "../routes";

/**
 * Renders ```mermaid fences to SVG at build, in the MermaidDiagram figure.
 * Shiki runs before user plugins, so `markdown.syntaxHighlight.excludeLangs`
 * must leave these fences unhighlighted.
 *
 * A build that drops `/dev/*` pages (`dropsDevPages`) never reaches the
 * renderer for one of their fences either, so it never launches headless
 * Chromium: Cloudflare Workers Builds can't install it, and no dev-page
 * diagram ships to production anyway. `astro dev`, vitest, and a build that
 * keeps dev pages still render them.
 *
 * @param root The project root, passed through to `isDevPageFile` — see
 *   there for why it can't just read `process.cwd()`.
 * @param keepDevPages True for a `DN_DEV_PAGES=1` build, which keeps the
 *   dev pages and so still renders their diagrams.
 */
export const mermaidDiagrams = (root: URL, keepDevPages = false) =>
	defineHastPlugin({
		name: "mermaid-diagrams",
		element: {
			filter: ["pre"],
			async visit(pre, ctx) {
				const code = pre.children.find(
					(child) => child.type === "element" && child.tagName === "code",
				);
				if (code?.type !== "element") return;
				// Sätteri keeps the fence's language in `data`, as Astro's highlighter reads it.
				const lang = (code.data as { lang?: string } | undefined)?.lang;
				if (lang !== "mermaid") return;
				if (dropsDevPages(keepDevPages) && isDevPageFile(ctx.fileURL, root))
					return;

				try {
					return {
						type: "raw",
						value: await renderMermaidFigure(ctx.textContent(code)),
					};
				} catch (error) {
					const file = ctx.fileURL?.pathname ?? "Markdown";
					throw new Error(`${file}: ${(error as Error).message}`, {
						cause: error,
					});
				}
			},
		},
	});
