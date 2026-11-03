import { pngToIco } from "@lib/favicon/ico";
import { renderFavicon } from "@lib/favicon/render";
import type { APIRoute } from "astro";

const SIZE = 32;

/** The tab icon: `favicon.svg` rasterized to 32×32 and wrapped in an ICO container, so browsers that don't read SVG favicons still get one (see BaseHead for the fallback order this depends on). */
export const GET: APIRoute = async () =>
	new Response(pngToIco(await renderFavicon(SIZE)), {
		headers: { "Content-Type": "image/vnd.microsoft.icon" },
	});
