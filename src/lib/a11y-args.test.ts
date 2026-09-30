import { describe, expect, it } from "vitest";
import { parseA11yArgs } from "./a11y-args";

describe("parseA11yArgs", () => {
	it("defaults to the production build and its report", () => {
		expect(parseA11yArgs([])).toEqual({
			dir: "dist",
			only: undefined,
			report: "reports/a11y/report.json",
		});
	});

	it("reads each option", () => {
		expect(
			parseA11yArgs([
				"--dir",
				"dist-dev",
				"--only",
				"/dev/",
				"--report",
				"reports/a11y/dev-pages.json",
			]),
		).toEqual({
			dir: "dist-dev",
			only: "/dev/",
			report: "reports/a11y/dev-pages.json",
		});
	});

	it("ignores pnpm's literal -- separator", () => {
		expect(parseA11yArgs(["--", "--dir", "dist-dev"]).dir).toBe("dist-dev");
	});

	it("rejects a prefix without a leading slash", () => {
		expect(() => parseA11yArgs(["--only", "dev/"])).toThrow(
			/starting with "\/"/,
		);
	});

	it("rejects an unknown flag rather than checking the default build", () => {
		expect(() => parseA11yArgs(["--dri", "dist-dev"])).toThrow();
	});

	it("rejects a stray positional argument", () => {
		expect(() => parseA11yArgs(["dist-dev"])).toThrow();
	});
});
