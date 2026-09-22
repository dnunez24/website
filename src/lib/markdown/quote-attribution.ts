import { defineHastPlugin } from "satteri";

/** The em dash that opens an attribution line, and the space after it. */
const LEADING_DASH = /^—\s*/;

/**
 * Makes a Markdown quote's attribution its `<footer>`, the element the
 * BlockQuote styles cite from. The attribution is the quote's last paragraph
 * when it starts with an em dash:
 *
 *     > Don't communicate by sharing memory, share memory by communicating.
 *     >
 *     > — Rob Pike, <cite>Go Proverbs</cite>
 *
 * The typed dash is dropped because CSS draws it before every quote footer.
 */
export const quoteAttribution = () =>
	defineHastPlugin({
		name: "quote-attribution",
		element: {
			filter: ["blockquote"],
			visit(blockquote, ctx) {
				const blocks = blockquote.children.filter(
					(child) => child.type === "element",
				);
				const last = blocks.at(-1);
				// A lone dash paragraph is the quote itself, not its attribution.
				if (blocks.length < 2 || last?.tagName !== "p") return;

				const [lead, ...rest] = last.children;
				if (lead?.type !== "text" || !LEADING_DASH.test(lead.value)) return;

				ctx.replaceNode(last, {
					type: "element",
					tagName: "footer",
					properties: {},
					children: [
						{ type: "text", value: lead.value.replace(LEADING_DASH, "") },
						...rest,
					],
				});
			},
		},
	});
