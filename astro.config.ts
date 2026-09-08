import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";
import { defineConfig, fontProviders } from "astro/config";

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

	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: "Afacad Flux",
			cssVariable: "--font-afacad-flux",
			fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
		},
		{
			provider: fontProviders.fontsource(),
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
		},
	],

	vite: {
		plugins: [tailwindcss()],
	},
});
