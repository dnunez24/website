/** Origin that serves the Cloudflare Web Analytics beacon. */
export const CF_BEACON_ORIGIN = "https://static.cloudflareinsights.com";

/** The beacon script itself, per Cloudflare's manual-setup snippet. */
export const CF_BEACON_SRC = `${CF_BEACON_ORIGIN}/beacon.min.js`;

/** Cloudflare site tokens are 32 lowercase hex characters. */
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/**
 * Validates a Cloudflare Web Analytics site token read from the build
 * environment (`PUBLIC_CF_WEB_ANALYTICS_TOKEN`, via `astro:env/client`).
 *
 * Returns `undefined` when the token is unset, which is the case everywhere
 * but production builds (see astro.config.ts): local dev, CI, and previews
 * all ship without the beacon. A token that's set but malformed throws, so
 * a typo fails the build loudly instead of shipping a broken beacon.
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
