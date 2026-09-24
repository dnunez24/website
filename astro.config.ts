import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";
import { defineConfig, fontProviders } from "astro/config";
import { loadEnv, type Plugin } from "vite";
import { SUBSETS } from "./scripts/fonts.config.ts";
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
// import.meta.env. loadEnv does, so this is the one place DN_DEV_PAGES is
// read, and the integration and the Vite plugin below share the result: a
// shell var and a .env entry now behave the same, and so does the photo
// import in design-system.astro, which reads the app-code side of the same
// variable.
const keepDevPages =
	loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "")
		.DN_DEV_PAGES === "1";

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

// https://astro.build/config
export default defineConfig({
	site: "https://davidanunez.com",
	// One URL form for the sitemap, canonical links and internal links. GitHub
	// Pages redirects `/about` to `/about/`, so slashless links cost a hop.
	trailingSlash: "always",

	// An article id starting with "page/" (e.g. content file writing/page/2.md)
	// would build the same URL as a Writing pagination page. Fail the build
	// instead of the default "warn", which would silently drop the article.
	prerenderConflictBehavior: "error",

	integrations: [mdx(), sitemap({ filter: isPublicPage }), excludeDevPages()],

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
