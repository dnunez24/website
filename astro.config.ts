import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";
import { defineConfig, envField, fontProviders } from "astro/config";
import { loadEnv, type Plugin } from "vite";
import { SUBSETS } from "./scripts/fonts.config.ts";
import { assertValidProdToken } from "./src/lib/cloudflare-analytics.ts";
import { callouts } from "./src/lib/markdown/callouts.ts";
import { mermaidDiagrams } from "./src/lib/markdown/mermaid.ts";
import { quoteAttribution } from "./src/lib/markdown/quote-attribution.ts";
import { tableScroll } from "./src/lib/markdown/table-scroll.ts";
import { taskListState } from "./src/lib/markdown/task-list.ts";
import { dropsDevPages, isDevRoute, isPublicPage } from "./src/lib/routes.ts";
import { syntaxTheme, syntaxTransformers } from "./src/lib/syntax.ts";

// This file's own directory is the project root, so the Mermaid plugin can
// match a dev-page file below without assuming `process.cwd()` is the
// root too: `astro build --root <path>` points Astro at the project
// without moving the working directory.
const projectRoot = new URL(".", import.meta.url);

// Config files don't load .env files on their own, unlike application code's
// import.meta.env. loadEnv does, so this is the one place DN_DEV_PAGES and
// the Cloudflare Web Analytics build guard's inputs are read, letting a
// shell var and a .env entry behave the same: excludeDevPages and the Vite
// plugin below share the DN_DEV_PAGES result with the photo import in
// design-system.astro, and failProdBuildWithoutToken below shares this same
// merged environment with astro:env/server (BaseHead.astro), rather than
// calling loadEnv a second time or reading process.env directly and missing
// a .env-only value.
const loadedEnv = loadEnv(
	process.env.NODE_ENV ?? "production",
	process.cwd(),
	"",
);
const keepDevPages = loadedEnv.DN_DEV_PAGES === "1";

/**
 * Keeps src/pages/dev/ out of a production build's CSS: appending the
 * exclusion to global.css only when Tailwind is about to compile it for a
 * `build` that isn't keeping the dev pages, so `astro dev` and a
 * `DN_DEV_PAGES=1` build both still get every utility the specimens use.
 */
function excludeDevPageClasses(): Plugin {
	return {
		name: "exclude-dev-page-classes",
		enforce: "pre",
		apply: (_config, { command }) => command === "build" && !keepDevPages,
		transform(code, id) {
			if (!/\/src\/styles\/global\.css(\?|$)/.test(id)) return;
			return `${code}\n@source not "../pages/dev";\n`;
		},
	};
}

function excludeDevPages(): AstroIntegration {
	const ansiBlue = "\x1b[34m";
	const ansiReset = "\x1b[0m";

	return {
		name: "exclude-dev-pages",
		hooks: {
			"astro:build:setup": ({ pages, logger }) => {
				if (!dropsDevPages(keepDevPages)) {
					if (keepDevPages) {
						logger.warn(
							"DN_DEV_PAGES=1: this build keeps /dev/* in dist/. Don't deploy it.",
						);
					}
					return;
				}
				for (const [page, data] of pages.entries()) {
					if (data.route.route && isDevRoute(data.route.route)) {
						logger.info(`page: ${ansiBlue}${data.component}${ansiReset}`);
						pages.delete(page);
					}
				}
			},
		},
	};
}

/**
 * Fails a Workers Builds production build (`WORKERS_CI=1`,
 * `WORKERS_CI_BRANCH=prod`) immediately when it's missing a valid
 * Cloudflare Web Analytics token, instead of shipping a page without the
 * beacon. `astro:build:start` only runs in the `astro build` pipeline, so
 * this never touches `astro dev`, `pnpm test` or `astro check`. Reads
 * `loadedEnv` (defined above, alongside `keepDevPages`) rather than
 * `process.env` directly or `astro:env/server`, so a value set only in a
 * `.env.production` file is seen the same way BaseHead.astro sees it
 * through `astro:env/server`, which merges those files too.
 */
function failProdBuildWithoutToken(): AstroIntegration {
	return {
		name: "fail-prod-build-without-token",
		hooks: {
			"astro:build:start": () => {
				assertValidProdToken({
					ci: loadedEnv.WORKERS_CI,
					branch: loadedEnv.WORKERS_CI_BRANCH,
					token: loadedEnv.PUBLIC_CF_WEB_ANALYTICS_TOKEN,
				});
			},
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: "https://davidanunez.com",
	// One URL form for the sitemap, canonical links and internal links.
	// Workers static assets 307-redirects `/about` to `/about/` under the
	// default `html_handling: "auto-trailing-slash"` (wrangler.jsonc), so
	// slashless links cost a hop.
	trailingSlash: "always",

	// An article id starting with "page/" (e.g. content file writing/page/2.md)
	// would build the same URL as a Writing pagination page. Fail the build
	// instead of the default "warn", which would silently drop the article.
	prerenderConflictBehavior: "error",

	build: {
		// Every page inlines its CSS in a <style> tag instead of linking one
		// shared /_astro/*.css file. That removes the render-blocking CSS
		// request from a first visit: HTML + CSS arrive in the same TCP
		// flight, which measured FCP/LCP 1,433 -> 750ms on Slow 4G (G2 perf
		// audit, finding 3). The trade-off is repeat page views: each one
		// re-downloads the same ~10KB of CSS (+~44ms) that an external,
		// cached file would instead skip. Most sessions on a personal site
		// are one page, so this should net positive; Cloudflare Web
		// Analytics' pages-per-visit can confirm that after launch. Only
		// affects `astro build`; `astro dev` still serves CSS through
		// Vite's own dev-time module graph.
		inlineStylesheets: "always",
	},

	integrations: [
		mdx(),
		sitemap({ filter: isPublicPage }),
		excludeDevPages(),
		failProdBuildWithoutToken(),
	],

	env: {
		schema: {
			// A build variable, set only on the Workers Builds Production tab,
			// never on Previews Base, so every preview (main's included), CI
			// and local build all ship without the beacon. Read at build time
			// in frontmatter only (BaseHead.astro), never by client code, so
			// "server" keeps it out of the client bundle. `length` catches a
			// truncated or padded token; src/lib/cloudflare-analytics.ts checks
			// the character set.
			PUBLIC_CF_WEB_ANALYTICS_TOKEN: envField.string({
				context: "server",
				access: "public",
				optional: true,
				length: 32,
			}),
			// Set to "1" by Workers Builds on every build it runs; unset for a
			// plain local `astro build`. BaseHead.astro checks it alongside
			// WORKERS_CI_BRANCH below, so a developer exporting
			// WORKERS_CI_BRANCH=prod plus a token locally still can't ship the
			// beacon from their own machine.
			WORKERS_CI: envField.string({
				context: "server",
				access: "public",
				optional: true,
			}),
			// Set by Workers Builds to the branch being built (e.g. "prod",
			// "main", a PR branch). BaseHead.astro reads it alongside the token
			// and WORKERS_CI above to gate the beacon to a Workers Builds
			// production build of "prod"; unset in astro dev, pnpm test, and
			// any build Workers Builds didn't run.
			WORKERS_CI_BRANCH: envField.string({
				context: "server",
				access: "public",
				optional: true,
			}),
		},
	},

	markdown: {
		// Mermaid fences render as diagrams (mermaidDiagrams), not as highlighted code.
		syntaxHighlight: { type: "shiki", excludeLangs: ["math", "mermaid"] },
		shikiConfig: {
			theme: syntaxTheme,
			transformers: syntaxTransformers,
		},
		processor: satteri({
			features: {
				smartPunctuation: true,
			},
			hastPlugins: [
				...callouts(),
				quoteAttribution(),
				mermaidDiagrams(projectRoot, keepDevPages),
				taskListState(),
				tableScroll(),
			],
		}),
	},

	fonts: [
		{
			// Self-hosted rather than provider-served: the Fontsource and Google
			// builds are subset with harfbuzz's default layout-feature list, which
			// strips `case`, `zero` and `ss01`–`ss04`, and they drop Afacad Flux's
			// slant axis. Regenerate the files with `pnpm fonts:build` after
			// editing `scripts/fonts.config.ts`.
			provider: fontProviders.local(),
			name: "Afacad Flux",
			cssVariable: "--font-afacad-flux",
			// Keep system-ui last: Astro builds metric-matched fallback faces from
			// the last entry only. system-ui gives BlinkMacSystemFont, Segoe UI,
			// Roboto, Helvetica Neue and Arial; sans-serif gives Arial alone, and
			// Android has no Arial.
			fallbacks: ["ui-sans-serif", "sans-serif", "system-ui"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/afacad-flux-latin-wght-normal.woff2"],
						weight: "400 600",
						style: "normal",
						unicodeRange: SUBSETS.latin,
					},
				],
			},
		},
		{
			provider: fontProviders.local(),
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			fallbacks: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/jetbrains-mono-latin-wght-normal.woff2"],
						weight: "400 700",
						style: "normal",
						unicodeRange: SUBSETS.latin,
					},
					{
						src: [
							"./src/assets/fonts/jetbrains-mono-italic-latin-wght-italic.woff2",
						],
						weight: "400 700",
						style: "italic",
						unicodeRange: SUBSETS.latin,
					},
				],
			},
		},
	],

	image: {
		responsiveStyles: true,
		layout: "constrained",
	},

	vite: {
		plugins: [excludeDevPageClasses(), tailwindcss()],
	},
});
