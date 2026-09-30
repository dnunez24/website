import { describe, expect, it } from "vitest";
import {
	assertValidProdToken,
	CF_BEACON_SRC,
	PROD_BRANCH,
	parseBeaconToken,
	resolveBeaconToken,
} from "./cloudflare-analytics";

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

describe("PROD_BRANCH", () => {
	it("is the Workers Builds production branch name", () => {
		expect(PROD_BRANCH).toBe("prod");
	});
});

describe("resolveBeaconToken", () => {
	it("returns the token for a Workers Builds production build of prod with a valid token", () => {
		expect(
			resolveBeaconToken({
				prod: true,
				ci: "1",
				branch: "prod",
				token: VALID_TOKEN,
			}),
		).toBe(VALID_TOKEN);
	});

	it("returns undefined for a Workers Builds production build of prod without a token", () => {
		expect(
			resolveBeaconToken({
				prod: true,
				ci: "1",
				branch: "prod",
				token: undefined,
			}),
		).toBeUndefined();
	});

	it("returns undefined for a Workers Builds production build of prod with a malformed token", () => {
		expect(
			resolveBeaconToken({
				prod: true,
				ci: "1",
				branch: "prod",
				token: "not-a-token",
			}),
		).toBeUndefined();
	});

	it("returns undefined on main, even in production with WORKERS_CI and a valid token", () => {
		expect(
			resolveBeaconToken({
				prod: true,
				ci: "1",
				branch: "main",
				token: VALID_TOKEN,
			}),
		).toBeUndefined();
	});

	it("returns undefined when the branch is unset, even in production with WORKERS_CI and a valid token", () => {
		expect(
			resolveBeaconToken({
				prod: true,
				ci: "1",
				branch: undefined,
				token: VALID_TOKEN,
			}),
		).toBeUndefined();
	});

	it("returns undefined outside production, even with WORKERS_CI, prod and a valid token", () => {
		expect(
			resolveBeaconToken({
				prod: false,
				ci: "1",
				branch: "prod",
				token: VALID_TOKEN,
			}),
		).toBeUndefined();
	});

	it("returns undefined in production on prod with a valid token when WORKERS_CI is unset (a local build)", () => {
		expect(
			resolveBeaconToken({
				prod: true,
				ci: undefined,
				branch: "prod",
				token: VALID_TOKEN,
			}),
		).toBeUndefined();
	});
});

describe("assertValidProdToken", () => {
	it("does not throw for a Workers Builds prod build with a valid token", () => {
		expect(() =>
			assertValidProdToken({ ci: "1", branch: "prod", token: VALID_TOKEN }),
		).not.toThrow();
	});

	it("throws for a Workers Builds prod build without a token", () => {
		expect(() =>
			assertValidProdToken({ ci: "1", branch: "prod", token: undefined }),
		).toThrow(/PUBLIC_CF_WEB_ANALYTICS_TOKEN is required/);
	});

	it("throws for a Workers Builds prod build with an empty token", () => {
		expect(() =>
			assertValidProdToken({ ci: "1", branch: "prod", token: "" }),
		).toThrow(/PUBLIC_CF_WEB_ANALYTICS_TOKEN is required/);
	});

	it("throws for a Workers Builds prod build with a malformed token", () => {
		expect(() =>
			assertValidProdToken({ ci: "1", branch: "prod", token: "not-a-token" }),
		).toThrow(/32 lowercase hex characters/);
	});

	it("does not throw on main without a token", () => {
		expect(() =>
			assertValidProdToken({ ci: "1", branch: "main", token: undefined }),
		).not.toThrow();
	});

	it("does not throw when the branch is unset", () => {
		expect(() =>
			assertValidProdToken({ ci: "1", branch: undefined, token: undefined }),
		).not.toThrow();
	});

	it("is a no-op for a local build on prod without a token, since WORKERS_CI is unset", () => {
		expect(() =>
			assertValidProdToken({ ci: undefined, branch: "prod", token: undefined }),
		).not.toThrow();
	});
});
