/** The Cloudflare Web Analytics beacon script, per Cloudflare's manual-setup snippet. */
export const CF_BEACON_SRC =
	"https://static.cloudflareinsights.com/beacon.min.js";

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
