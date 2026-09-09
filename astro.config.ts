import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import syntaxTheme from "@styles/shiki-theme.json";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration, ShikiConfig } from "astro";
import { defineConfig, fontProviders } from "astro/config";
import satteriCallouts from "satteri-callouts";

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
			hastPlugins: [satteriCallouts()],
		}),
	},

	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: "Afacad Flux",
			cssVariable: "--font-family-sans",
			fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
			weights: [300, 400, 500, 600],
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
