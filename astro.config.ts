// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";
import { defineConfig, fontProviders } from "astro/config";

import react from "@astrojs/react";

function excludeDevPages(): AstroIntegration {
    return {
        name: "exclude-dev-pages",
        hooks: {
            "astro:build:setup": ({ pages, vite }) => {
                // pages.delete("key")
            },
            "astro:build:done": ({ dir, logger }) => {
                const shouldExcludePage = process.env.BUILD_CONTEXT === "dev";

                if (shouldExcludePage) {
                    const qaDir = fileURLToPath(new URL("./preview", dir));
                    if (existsSync(qaDir)) {
                        rmSync(qaDir, { recursive: true, force: true });
                    }
                }
            },
        },
    };
}

// https://astro.build/config
export default defineConfig({
    site: "https://example.com",
    integrations: [mdx(), sitemap(), react()],

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