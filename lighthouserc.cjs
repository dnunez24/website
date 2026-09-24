// CommonJS (not lighthouserc.js): the package is "type": "module", and
// @lhci/cli loads this config with require(), which can't load an ES module.

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
			// No chromePath: system Chrome (google-chrome-stable on ubuntu-latest;
			// whatever's installed locally), not Playwright's headless shell. A
			// `chromium.executablePath()`/cache-scan of Playwright's install was
			// tried and reverted — collect.chromePath (not collect.settings, which
			// only reaches the Lighthouse CLI, never chrome-launcher) is the
			// correct key, but the headless shell is the wrong browser regardless:
			// Lighthouse can't test back/forward cache in old Headless Chrome, and
			// LCP reads differently than in a real Chrome process. ci.yml's perf
			// job logs the Chrome version chrome-launcher actually picks.
			// Mobile emulation is Lighthouse's own default; not overridden here.
		},
		assert: {
			// Lighthouse CI's own default aggregation across multiple runs is
			// "optimistic" (the most-likely-to-pass value); every assertion below
			// uses the median instead.
			aggregationMethod: "median",
			assertions: {
				"categories:performance": ["error", { minScore: 0.95 }],
				"categories:accessibility": ["error", { minScore: 1 }],
				"categories:best-practices": ["error", { minScore: 1 }],
				"categories:seo": ["error", { minScore: 1 }],
				// The build ships no <script> at all today (see
				// scripts/check-no-js.ts, which also catches what this
				// network-requests-only budget can't: inline scripts and
				// inline event handlers).
				"resource-summary:script:size": ["error", { maxNumericValue: 0 }],
			},
		},
		upload: {
			target: "filesystem",
			outputDir: "./reports/lhci",
		},
	},
};
