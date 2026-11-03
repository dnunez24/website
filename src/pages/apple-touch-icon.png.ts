import { renderFavicon } from "@lib/favicon/render";
import type { APIRoute } from "astro";

const SIZE = 180;

/** iOS's home-screen icon: `favicon.svg` rasterized to 180×180 and flattened opaque, since Apple ignores alpha here. */
export const GET: APIRoute = async () =>
	new Response(await renderFavicon(SIZE, { opaque: true }), {
		headers: { "Content-Type": "image/png" },
	});
