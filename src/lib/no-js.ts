import { Window } from "happy-dom";

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

const { DOMParser } = new Window();

/**
 * Every `<script>` except JSON-LD and the sanctioned beacon, and every
 * inline `on*` event-handler attribute, is a regression: this site ships no
 * JavaScript. Catches what `resource-summary:script:size` in
 * `lighthouserc.cjs` can't — that budget only counts network requests, so
 * an inline `<script>` with real content, or an `onclick`, passes it at 0
 * bytes.
 */
export function checkPageForScripts(html: string, page: string): NoJsIssue[] {
	const issues: NoJsIssue[] = [];
	const document = new DOMParser().parseFromString(html, "text/html");

	for (const script of document.querySelectorAll("script")) {
		const type = script.getAttribute("type");
		const src = script.getAttribute("src");
		if (type === "application/ld+json") continue;
		if (src === ALLOWED_SCRIPT_SRC) continue;
		const label = src ? `<script src="${src}">` : "inline <script>";
		issues.push({
			page,
			message: `${label} is not allowed (see the exceptions in src/lib/no-js.ts)`,
		});
	}

	for (const element of document.querySelectorAll("*")) {
		for (const attribute of element.attributes) {
			if (/^on/i.test(attribute.name)) {
				issues.push({
					page,
					message: `<${element.tagName.toLowerCase()} ${attribute.name}="…"> inline event handler is not allowed`,
				});
			}
		}
	}

	return issues;
}
