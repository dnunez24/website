import { getCollection } from "astro:content";
import { articleCardSvg, toPng } from "@lib/share-image/cards";
import type { APIRoute, InferGetStaticPropsType } from "astro";

/** One card per article, at the path `articleShareImage` in `@lib/seo` gives it. */
export async function getStaticPaths() {
	const articles = await getCollection("writing");
	return articles.map((article) => ({
		params: { slug: article.id },
		props: { title: article.data.title, subtitle: article.data.subtitle },
	}));
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = async ({ props }) => {
	const { svg } = await articleCardSvg(props);
	return new Response(await toPng(svg), {
		headers: { "Content-Type": "image/png" },
	});
};
