import { defaultCardSvg, toPng } from "@lib/share-image/cards";
import type { APIRoute } from "astro";

/** The share card for every page but articles. */
export const GET: APIRoute = async () =>
	new Response(await toPng(await defaultCardSvg()), {
		headers: { "Content-Type": "image/png" },
	});
