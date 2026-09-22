import type { APIContext } from "astro";

/** Crawlers find the sitemap here; `<link rel="sitemap">` is not a standard they read. */
export function GET({ site }: APIContext) {
	if (site === undefined) {
		throw new Error(
			"robots.txt needs `site` in astro.config.ts to build an absolute sitemap URL.",
		);
	}
	const sitemap = new URL("sitemap-index.xml", site);
	return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
