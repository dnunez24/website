import { AxeBuilder } from "@axe-core/playwright";
import type { Result } from "axe-core";
import type { Page } from "playwright";

/** WCAG 2.2 AA and everything it supersedes. axe-core's own default rule set predates 2.2. */
export const WCAG_TAGS = [
	"wcag2a",
	"wcag2aa",
	"wcag21a",
	"wcag21aa",
	"wcag22aa",
];

/**
 * A WCAG 2.2 rule, tagged `wcag22aa` but shipped disabled by default (axe
 * added 2.2 support before treating its rules as stable). `withTags` alone
 * won't run it — it has to be turned on explicitly, which is also why
 * `checkPageAccessibility` asserts it actually ran: an axe-core upgrade that
 * renames or drops this id should fail loudly, not silently stop checking it.
 */
const WCAG_22_RULE_TO_VERIFY = "target-size";

export interface A11yPageResult {
	/** The page's path, e.g. `/writing/first-post/`; a label, not used to navigate. */
	url: string;
	width: number;
	violations: Result[];
	/** "Needs review": axe couldn't determine pass/fail automatically. */
	incomplete: Result[];
}

/**
 * Runs axe against whatever `page` currently has loaded, at the given
 * viewport size. Doesn't navigate or manage the browser itself, so it's
 * equally easy to point at a live server (`check-a11y.ts`) or at
 * `page.setContent(...)` in a test.
 */
export async function checkPageAccessibility(
	page: Page,
	url: string,
	width: number,
	height: number,
): Promise<A11yPageResult> {
	await page.setViewportSize({ width, height });

	// One `.options()` call, not `.withTags()` + `.options()`: AxeBuilder's
	// `options()` assigns wholesale rather than merging, so calling it after
	// `withTags()` silently wipes the tag filter and falls back to axe's full
	// default rule set (caught by a test asserting non-WCAG rules stay out).
	const results = await new AxeBuilder({ page })
		.options({
			runOnly: { type: "tag", values: WCAG_TAGS },
			rules: { [WCAG_22_RULE_TO_VERIFY]: { enabled: true } },
		})
		.analyze();

	const ran = [
		...results.violations,
		...results.passes,
		...results.inapplicable,
	].some((result) => result.id === WCAG_22_RULE_TO_VERIFY);
	if (!ran) {
		throw new Error(
			`axe didn't run "${WCAG_22_RULE_TO_VERIFY}" against ${url} at ${width}px — ` +
				"check the rule id against the installed axe-core version.",
		);
	}

	return {
		url,
		width,
		violations: results.violations,
		incomplete: results.incomplete,
	};
}
