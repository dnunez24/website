import { describe, expect, it } from "vitest";
import { CF_BEACON_SRC, parseBeaconToken } from "./cloudflare-analytics";

const VALID_TOKEN = "0123456789abcdef0123456789abcdef";

describe("CF_BEACON_SRC", () => {
	it("points at Cloudflare's beacon script", () => {
		expect(CF_BEACON_SRC).toBe(
			"https://static.cloudflareinsights.com/beacon.min.js",
		);
	});
});

describe("parseBeaconToken", () => {
	it("returns undefined when unset", () => {
		expect(parseBeaconToken(undefined)).toBeUndefined();
	});

	it("returns undefined for an empty string", () => {
		expect(parseBeaconToken("")).toBeUndefined();
	});

	it("returns a valid 32-character lowercase hex token unchanged", () => {
		expect(parseBeaconToken(VALID_TOKEN)).toBe(VALID_TOKEN);
	});

	it("throws when the token is too short", () => {
		expect(() => parseBeaconToken(VALID_TOKEN.slice(0, 31))).toThrow(
			/32 lowercase hex characters/,
		);
	});

	it("throws when the token is too long", () => {
		expect(() => parseBeaconToken(`${VALID_TOKEN}0`)).toThrow(
			/32 lowercase hex characters/,
		);
	});

	it("throws when the token has uppercase characters", () => {
		expect(() => parseBeaconToken(VALID_TOKEN.toUpperCase())).toThrow(
			/32 lowercase hex characters/,
		);
	});

	it("throws when the token has non-hex characters", () => {
		expect(() => parseBeaconToken("g".repeat(32))).toThrow(
			/32 lowercase hex characters/,
		);
	});

	it("names the offending value in the error", () => {
		expect(() => parseBeaconToken("not-a-token")).toThrow(/"not-a-token"/);
	});
});
