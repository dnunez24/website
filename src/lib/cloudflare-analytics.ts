/** The Cloudflare Web Analytics beacon script, per Cloudflare's manual-setup snippet. */
export const CF_BEACON_SRC =
	"https://static.cloudflareinsights.com/beacon.min.js";

/**
 * The Workers Builds branch that deploys production (`wrangler deploy`,
 * davidanunez.com). Every other branch, `main` included, runs `wrangler
 * preview` instead. Workers Builds sets `WORKERS_CI_BRANCH` to the branch
 * it's building, so this is the one place that string is spelled.
 */
export const PROD_BRANCH = "prod";

/**
 * Cloudflare doesn't publish a token format spec. Every example in their
 * docs and public API schema is 32 lowercase hex characters, so that's
 * what this checks.
 */
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/**
 * Validates a Cloudflare Web Analytics site token.
 *
 * Returns `undefined` when the token is unset. Throws when it's set but
 * malformed, so a typo fails the build loudly instead of shipping a
 * broken beacon.
 */
export function parseBeaconToken(raw: string | undefined): string | undefined {
	if (raw === undefined || raw === "") return undefined;
	if (!TOKEN_PATTERN.test(raw)) {
		throw new Error(
			`PUBLIC_CF_WEB_ANALYTICS_TOKEN must be 32 lowercase hex characters, got ${JSON.stringify(raw)}.`,
		);
	}
	return raw;
}

/** Inputs to the render decision: {@link resolveBeaconToken}. */
export interface BeaconRenderInput {
	/** `import.meta.env.PROD` — false for `astro dev` and Vitest. */
	prod: boolean;
	/** `WORKERS_CI_BRANCH`, set by Workers Builds; unset locally and in CI. */
	branch: string | undefined;
	/** The raw `PUBLIC_CF_WEB_ANALYTICS_TOKEN` value, unparsed. */
	token: string | undefined;
}

/**
 * The token to pass to `<CloudflareAnalytics>`, or `undefined` to render
 * nothing. Ships the beacon only for a production build of the `prod`
 * branch: `astro dev`, `pnpm test`, CI, and every preview build (`main`'s
 * included) all render nothing, regardless of the token.
 *
 * An unparseable token here resolves to `undefined` rather than throwing —
 * `assertValidProdToken` below fails the build earlier for that case, so a
 * throw here should be unreachable outside a test.
 */
export function resolveBeaconToken({
	prod,
	branch,
	token,
}: BeaconRenderInput): string | undefined {
	if (!prod || branch !== PROD_BRANCH) return undefined;
	try {
		return parseBeaconToken(token);
	} catch {
		return undefined;
	}
}

/**
 * Fails the build immediately when a `prod` branch build is missing a
 * valid token, instead of silently shipping a page without the beacon.
 * A no-op for every other branch, including when `branch` is unset (local
 * builds, CI, previews).
 */
export function assertValidProdToken({
	branch,
	token,
}: {
	branch: string | undefined;
	token: string | undefined;
}): void {
	if (branch !== PROD_BRANCH) return;
	if (token === undefined || token === "") {
		throw new Error(
			`PUBLIC_CF_WEB_ANALYTICS_TOKEN is required on the "${PROD_BRANCH}" branch build. Set it as a build variable on the Workers Builds Production tab.`,
		);
	}
	parseBeaconToken(token);
}
