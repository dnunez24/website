import { defineHastPlugin } from "satteri";
import { renderMermaidFigure } from "../mermaid";

/**
 * Renders ```mermaid fences to SVG at build, in the MermaidDiagram figure.
 * Shiki runs before user plugins, so `markdown.syntaxHighlight.excludeLangs`
 * must leave these fences unhighlighted.
 */
export const mermaidDiagrams = () =>
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
