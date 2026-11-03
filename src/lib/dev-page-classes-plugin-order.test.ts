import { describe, expect, it } from "vitest";
import config from "../../astro.config.ts";

/**
 * @tailwindcss/vite registers 3 plugins, all `enforce: "pre"` with no
 * hook-level `order`, so Vite runs same-`enforce` plugins in array order.
 * The dev-page CSS exclusion only works because it's listed first in
 * astro.config.ts's `vite.plugins` - `enforce: "pre"` alone doesn't
 * guarantee that. This asserts the array position directly, so swapping
 * the two entries fails this test instead of silently shipping ~8 KB of
 * dev-only utilities in production.
 */
describe("astro.config.ts Vite plugin order", () => {
	it("lists exclude-dev-page-classes before every @tailwindcss/vite plugin", () => {
		// @tailwindcss/vite's factory returns an array of 3 plugins, one level
		// of nesting; flat(Infinity) makes TS's FlatArray type recurse forever.
		const plugins = (config.vite?.plugins ?? []).flat(1) as Array<{
			name?: string;
		}>;

		const excludeIndex = plugins.findIndex(
			(plugin) => plugin?.name === "exclude-dev-page-classes",
		);
		const tailwindIndices = plugins
			.map((plugin, index) =>
				plugin?.name?.startsWith("@tailwindcss/vite") ? index : -1,
			)
			.filter((index) => index !== -1);

		expect(excludeIndex).toBeGreaterThanOrEqual(0);
		expect(tailwindIndices.length).toBeGreaterThan(0);
		for (const tailwindIndex of tailwindIndices) {
			expect(excludeIndex).toBeLessThan(tailwindIndex);
		}
	});
});
