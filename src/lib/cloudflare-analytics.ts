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
	/** `import.meta.env.PROD`, false for `astro dev` and Vitest. */
	prod: boolean;
	/** `WORKERS_CI`, set to `"1"` by Workers Builds; unset for a plain local `astro build`. */
	ci: string | undefined;
	/** `WORKERS_CI_BRANCH`, set by Workers Builds; unset locally and in CI. */
	branch: string | undefined;
	/** The raw `PUBLIC_CF_WEB_ANALYTICS_TOKEN` value, unparsed. */
	token: string | undefined;
}

/**
 * The token to pass to `<CloudflareAnalytics>`, or `undefined` to render
 * nothing. Ships the beacon only for a production build of the `prod`
 * branch, run by Workers Builds itself (`ci === "1"`): `astro dev`,
 * `pnpm test`, a plain local `astro build`, and every preview build
 * (`main`'s included) all render nothing, regardless of the token. The
 * `ci` check is what stops a local `astro build` with `WORKERS_CI_BRANCH`
 * and the token both exported (or set in a `.env.production` file) from
 * shipping the beacon.
 *
 * An unparseable token here resolves to `undefined` rather than throwing.
 * `assertValidProdToken` below fails the build earlier for that case, so a
 * throw here should be unreachable outside a test.
 */
export function resolveBeaconToken({
	prod,
	ci,
	branch,
	token,
}: BeaconRenderInput): string | undefined {
	if (!prod || ci !== "1" || branch !== PROD_BRANCH) return undefined;
	try {
		return parseBeaconToken(token);
	} catch {
		return undefined;
	}
}

/**
 * Fails the build immediately when a Workers Builds production build (`ci
 * === "1"`, `branch === "prod"`) is missing a valid token, instead of
 * silently shipping a page without the beacon. A no-op otherwise: a plain
 * local `astro build` on `prod` (no `WORKERS_CI`), any other branch, or
 * `branch` unset (local builds, CI, previews).
 */
export function assertValidProdToken({
	ci,
	branch,
	token,
}: {
	ci: string | undefined;
	branch: string | undefined;
	token: string | undefined;
}): void {
	if (ci !== "1" || branch !== PROD_BRANCH) return;
	if (token === undefined || token === "") {
		throw new Error(
			`PUBLIC_CF_WEB_ANALYTICS_TOKEN is required on the "${PROD_BRANCH}" branch build. Set it as a build variable on the Workers Builds Production tab.`,
		);
	}
	parseBeaconToken(token);
}
