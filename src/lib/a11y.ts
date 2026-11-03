import { AxeBuilder } from "@axe-core/playwright";
import type { Result } from "axe-core";
import type { Page, Request, Response } from "playwright";

/** WCAG 2.2 AA and everything it supersedes. axe-core's own default rule set predates 2.2. */
export const WCAG_TAGS = [
	"wcag2a",
	"wcag2aa",
	"wcag21a",
	"wcag21aa",
	"wcag22aa",
];

/**
 * A WCAG 2.2 rule. A `runOnly` tag match is enough on its own to run a rule
 * that's disabled by default — the `rules` override below is belt and
 * braces, in case a future axe-core version ships a rule that's opted out
 * even under its own tag. `checkPageAccessibility` asserts this rule
 * actually ran rather than trusting either mechanism silently worked.
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

export interface CheckPageAccessibilityOptions {
	page: Page;
	/** Navigated to directly, so it must be a full URL the page can `goto`. */
	url: string;
	/** How the page is identified in results; defaults to `url`. */
	label?: string;
	width: number;
	height: number;
	/**
	 * The main navigation response's required HTTP status. Defaults to
	 * requiring `response.ok()` (2xx); pass e.g. `404` for a page that's
	 * deliberately expected to 404, such as the site's own 404 page.
	 */
	expectedStatus?: number;
}

/**
 * Navigates to `url` and runs axe against it, at the given viewport size.
 * Treats a bad page load as a failure rather than an empty result: a
 * non-matching response status, an uncaught page error, a failed request, or
 * any subresource response of 400 or above all throw, so a page that loads
 * badly can't silently report as clean.
 */
export async function checkPageAccessibility({
	page,
	url,
	label = url,
	width,
	height,
	expectedStatus,
}: CheckPageAccessibilityOptions): Promise<A11yPageResult> {
	// Before navigating: responsive images and layout depend on viewport size.
	await page.setViewportSize({ width, height });

	const pageErrors: Error[] = [];
	const failedRequests: Request[] = [];
	const responses: Response[] = [];
	const onPageError = (error: Error) => pageErrors.push(error);
	const onRequestFailed = (request: Request) => failedRequests.push(request);
	const onResponse = (response: Response) => responses.push(response);
	page.on("pageerror", onPageError);
	page.on("requestfailed", onRequestFailed);
	page.on("response", onResponse);

	try {
		const mainResponse = await page.goto(url);

		const statusOk =
			expectedStatus === undefined
				? (mainResponse?.ok() ?? false)
				: mainResponse?.status() === expectedStatus;
		if (!statusOk) {
			const got = mainResponse ? mainResponse.status() : "no response";
			const wanted = expectedStatus === undefined ? "ok" : expectedStatus;
			throw new Error(`${label} responded ${got}, expected ${wanted}`);
		}
		if (pageErrors.length > 0) {
			throw new Error(
				`${label} threw a script error: ${pageErrors[0]?.message}`,
			);
		}
		if (failedRequests.length > 0) {
			const request = failedRequests[0];
			throw new Error(
				`${label} had a failed request: ${request?.method()} ${request?.url()} (${request?.failure()?.errorText ?? "failed"})`,
			);
		}
		const badSubresource = responses.find(
			(response) => response !== mainResponse && response.status() >= 400,
		);
		if (badSubresource) {
			throw new Error(
				`${label} loaded a subresource that responded ${badSubresource.status()}: ${badSubresource.url()}`,
			);
		}

		// Custom web fonts can still be swapping in; wait so contrast and
		// target-size measurements reflect the fonts the page will actually
		// render, not a fallback.
		await page.evaluate(() => document.fonts.ready);

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

		// "Ran" includes incomplete: a rule axe couldn't fully resolve (e.g. a
		// target it can't be sure isn't exempt) still ran — it just needs a
		// human. Only silence — none of the four buckets — means it didn't.
		const ran = [
			...results.violations,
			...results.passes,
			...results.inapplicable,
			...results.incomplete,
		].some((result) => result.id === WCAG_22_RULE_TO_VERIFY);
		if (!ran) {
			throw new Error(
				`axe didn't run "${WCAG_22_RULE_TO_VERIFY}" against ${label} at ${width}px — ` +
					"check the rule id against the installed axe-core version.",
			);
		}

		return {
			url: label,
			width,
			violations: results.violations,
			incomplete: results.incomplete,
		};
	} finally {
		page.off("pageerror", onPageError);
		page.off("requestfailed", onRequestFailed);
		page.off("response", onResponse);
	}
}
