import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";
import { defineConfig, fontProviders } from "astro/config";
import satteriCallouts from "satteri-callouts";
import { SUBSETS } from "./scripts/fonts.config.ts";
import { quoteAttribution } from "./src/lib/markdown/quote-attribution.ts";
import { isDevRoute, isPublicPage } from "./src/lib/routes.ts";
import { syntaxTheme, syntaxTransformers } from "./src/lib/syntax.ts";

function excludeDevPages(): AstroIntegration {
	const ansiBlue = "\x1b[34m";
	const ansiReset = "\x1b[0m";

	return {
		name: "exclude-dev-pages",
		hooks: {
			"astro:build:setup": ({ pages, logger }) => {
				if (import.meta.env.PROD) {
					for (const [page, data] of pages.entries()) {
						if (data.route.route && isDevRoute(data.route.route)) {
							logger.info(`page: ${ansiBlue}${data.component}${ansiReset}`);
							pages.delete(page);
						}
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

	integrations: [mdx(), sitemap({ filter: isPublicPage }), excludeDevPages()],

	markdown: {
		shikiConfig: {
			theme: syntaxTheme,
			transformers: syntaxTransformers,
		},
		processor: satteri({
			features: {
				smartPunctuation: true,
			},
			hastPlugins: [satteriCallouts(), quoteAttribution()],
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
			fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/afacad-flux-latin-wght-normal.woff2"],
						weight: "100 1000",
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
						weight: "100 800",
						style: "normal",
						unicodeRange: SUBSETS.latin,
					},
					{
						src: [
							"./src/assets/fonts/jetbrains-mono-italic-latin-wght-italic.woff2",
						],
						weight: "100 800",
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
		plugins: [tailwindcss()],
	},
});
