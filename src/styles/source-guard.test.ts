import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, scannedFiles } from "../test/classes";

/**
 * Tailwind generates a utility for every class-shaped word in the files it
 * scans, and test names and strings are prose: "transform", "grow" and
 * "invisible" are all utilities. Scanned, they ship as dead CSS inlined into
 * every page (astro.config.ts's `inlineStylesheets`), and no other test sees
 * it: the site looks the same. This checks the scanner's file list rather
 * than the compiled CSS, so it holds whatever words a future test uses.
 */
describe("Tailwind's class scan", () => {
	it("reads no test file", async () => {
		const testFiles = (await scannedFiles()).filter((file) =>
			file.endsWith(".test.ts"),
		);
		expect(testFiles).toEqual([]);
	});

	it("still reads the site's own source", async () => {
		expect(await scannedFiles()).toContain(
			join(ROOT, "src/components/Button.astro"),
		);
	});

	it("reads test files without global.css's exclusion, by mutation", async () => {
		const css = await readFile(join(ROOT, "src/styles/global.css"), "utf8");
		const mutated = css.replace('@source not "../**/*.test.ts";', "");
		expect(mutated).not.toBe(css);

		expect(await scannedFiles(mutated)).toEqual(
			expect.arrayContaining([
				join(ROOT, "src/styles/prose.test.ts"),
				join(ROOT, "src/lib/markdown/callouts.test.ts"),
			]),
		);
	});
});
