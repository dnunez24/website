import { type DefaultTreeAdapterTypes as P5, parse } from "parse5";

export interface NoJsIssue {
	page: string;
	message: string;
}

/**
 * The one sanctioned script: Cloudflare Web Analytics' beacon, added by a
 * parallel PR and only present in production builds (no token in CI, so it
 * doesn't render there — this exception exists for when it does).
 */
const ALLOWED_SCRIPT_SRC =
	"https://static.cloudflareinsights.com/beacon.min.js";

/** Attributes that can carry a URL, checked for a `javascript:` scheme. */
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction"]);

const isElement = (node: P5.Node): node is P5.Element => "tagName" in node;
const isTemplate = (node: P5.Node): node is P5.Template => "content" in node;

const isJavascriptUrl = (value: string): boolean =>
	value.trim().toLowerCase().startsWith("javascript:");

/**
 * Every `<script>` except JSON-LD and the sanctioned beacon; every inline
 * `on*` event-handler attribute; every `javascript:` URL (in `href`, `src`,
 * `action`, `formaction`, or SVG's `xlink:href`); and every `<iframe
 * srcdoc>` is a regression: this site ships no JavaScript. Catches what
 * `resource-summary:script:size` in `lighthouserc.cjs` can't — that budget
 * only counts network requests, so an inline `<script>` with real content,
 * or an `onclick`, passes it at 0 bytes.
 *
 * Parsed with parse5, not happy-dom: happy-dom 20.14.5 silently drops
 * everything from an SVG `<style>` or `<script>` to the end of the
 * document, which made this check blind after a Mermaid diagram (whose
 * rendered SVG always has a `<style>`). parse5 is spec-compliant HTML5
 * parsing and doesn't have that bug; walking its tree also naturally covers
 * every namespace (HTML, SVG, MathML) in one pass, so `<script>` inside an
 * SVG is caught the same as anywhere else.
 */
export function checkPageForScripts(html: string, page: string): NoJsIssue[] {
	const issues: NoJsIssue[] = [];

	function visit(node: P5.Node): void {
		if (isElement(node)) {
			if (node.tagName === "script") {
				const type = node.attrs.find((attr) => attr.name === "type")?.value;
				const src = node.attrs.find((attr) => attr.name === "src")?.value;
				if (type !== "application/ld+json" && src !== ALLOWED_SCRIPT_SRC) {
					const label = src ? `<script src="${src}">` : "inline <script>";
					issues.push({
						page,
						message: `${label} is not allowed (see the exceptions in src/lib/no-js.ts)`,
					});
				}
			}

			if (
				node.tagName === "iframe" &&
				node.attrs.some((attr) => attr.name === "srcdoc")
			) {
				issues.push({ page, message: "<iframe srcdoc=…> is not allowed" });
			}

			for (const attr of node.attrs) {
				const displayName = attr.prefix
					? `${attr.prefix}:${attr.name}`
					: attr.name;

				if (/^on/i.test(attr.name)) {
					issues.push({
						page,
						message: `<${node.tagName} ${displayName}="…"> inline event handler is not allowed`,
					});
					continue;
				}

				const isUrlAttribute =
					URL_ATTRIBUTES.has(attr.name) ||
					(attr.prefix === "xlink" && attr.name === "href");
				if (isUrlAttribute && isJavascriptUrl(attr.value)) {
					issues.push({
						page,
						message: `<${node.tagName} ${displayName}="javascript:…"> is not allowed`,
					});
				}
			}
		}

		// A <template>'s real children live in .content.childNodes, not its
		// own childNodes (which parse5, like the HTML spec, leaves empty).
		if (isTemplate(node)) visit(node.content);
		if ("childNodes" in node) {
			for (const child of node.childNodes) visit(child);
		}
	}

	visit(parse(html));
	return issues;
}
