import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import syntaxTheme from "@styles/shiki-theme.json";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration, ShikiConfig } from "astro";
import { defineConfig, fontProviders } from "astro/config";
import satteriCallouts from "satteri-callouts";
import { SUBSETS } from "./scripts/fonts.config.ts";

function excludeDevPages(): AstroIntegration {
	const ansiBlue = "\x1b[34m";
	const ansiReset = "\x1b[0m";

	return {
		name: "exclude-dev-pages",
		hooks: {
			"astro:build:setup": ({ pages, logger }) => {
				if (import.meta.env.PROD) {
					for (const [page, data] of pages.entries()) {
						if (data.route.route?.match(/^\/dev\//)) {
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
	site: "https://example.com",

	integrations: [mdx(), sitemap(), react(), excludeDevPages()],

	markdown: {
		shikiConfig: {
			theme: syntaxTheme as NonNullable<ShikiConfig["theme"]>,
		},
		processor: satteri({
			features: {
				smartPunctuation: true,
			},
			hastPlugins: [satteriCallouts()],
		}),
	},

	fonts: [
		{
			// Self-hosted rather than provider-served: the Fontsource and Google
			// builds are subset with harfbuzz's default layout-feature list, which
			// strips `case`, `zero` and `ss01`–`ss04`. Regenerate the file with
			// `pnpm fonts:build` after editing `scripts/fonts.config.ts`.
			provider: fontProviders.local(),
			name: "Afacad Flux",
			cssVariable: "--font-family-sans",
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
			provider: fontProviders.fontsource(),
			name: "JetBrains Mono",
			cssVariable: "--font-family-mono",
			fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
			weights: [300, 400, 500, 600],
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
