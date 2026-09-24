// CommonJS (not lighthouserc.js): the package is "type": "module", and
// @lhci/cli loads this config with require(), which can't load an ES module.
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const os = require("node:os");

/**
 * Playwright's installed Chromium (the headless shell `pnpm diagrams:browser`
 * installs), reused instead of a second browser stack — see check-a11y.ts
 * and the a11y layer's commit history for why. `chromium.executablePath()`
 * from the `playwright` package isn't usable here: it returns the *full*
 * Chromium build's path regardless of what's actually on disk, and this repo
 * only ever installs the headless shell. So this scans Playwright's own
 * cache directory for what's really there, the same layout
 * `playwright install --dry-run` reports.
 */
function findPlaywrightHeadlessShell() {
	const cacheDir =
		process.env.PLAYWRIGHT_BROWSERS_PATH ||
		join(
			os.homedir(),
			process.platform === "darwin"
				? "Library/Caches/ms-playwright"
				: ".cache/ms-playwright",
		);

	const revisions = readdirSync(cacheDir)
		.filter((name) => name.startsWith("chromium_headless_shell-"))
		.sort()
		.reverse();
	const revision = revisions[0];
	if (!revision) {
		throw new Error(
			`No chrome-headless-shell install found under ${cacheDir}. Run \`pnpm diagrams:browser\` first.`,
		);
	}

	const revisionDir = join(cacheDir, revision);
	const platformDir = readdirSync(revisionDir).find((name) =>
		name.startsWith("chrome-headless-shell-"),
	);
	if (!platformDir) {
		throw new Error(
			`No chrome-headless-shell binary found under ${revisionDir}.`,
		);
	}

	return join(revisionDir, platformDir, "chrome-headless-shell");
}

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Every assertion needs this explicitly: Lighthouse CI's own default
// aggregation across multiple runs is "optimistic" (the most-likely-to-pass
// value), not "median".
const median = { aggregationMethod: "median" };

module.exports = {
	ci: {
		collect: {
			url: [
				`${BASE_URL}/`,
				`${BASE_URL}/writing/`,
				// Exercises Mermaid, code blocks and block quotes in one page.
				`${BASE_URL}/writing/markdown-style-guide/`,
				`${BASE_URL}/about/`,
				`${BASE_URL}/topics/`,
			],
			numberOfRuns: 3,
			startServerCommand: `pnpm run serve:dist -- ${PORT}`,
			// Printed by scripts/serve-dist.ts; keep the two in sync.
			startServerReadyPattern: "Listening on",
			startServerReadyTimeout: 30_000,
			settings: {
				chromePath: findPlaywrightHeadlessShell(),
				// Mobile emulation is Lighthouse's own default; not overridden here.
			},
		},
		assert: {
			assertions: {
				"categories:performance": ["error", { minScore: 0.95, ...median }],
				"categories:accessibility": ["error", { minScore: 1, ...median }],
				"categories:best-practices": ["error", { minScore: 1, ...median }],
				"categories:seo": ["error", { minScore: 1, ...median }],
				// CI builds have no analytics token (see astro.config.mjs / the
				// analytics layer), so the built pages ship no script at all.
				"resource-summary:script:size": [
					"error",
					{ maxNumericValue: 0, ...median },
				],
				// Canonical URLs point at https://davidanunez.com (astro.config.mjs's
				// `site`), so this audit fails against a localhost origin on
				// principle, not because anything is wrong. Production checks (the
				// deployed site, once it's live) cover this audit instead.
				canonical: "off",
			},
		},
		upload: {
			target: "filesystem",
			outputDir: "./reports/lhci",
		},
	},
};
