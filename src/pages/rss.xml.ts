import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "@constants";
import { articleHref, getArticles } from "@lib/writing";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
	const articles = await getArticles();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site ?? "",
		items: articles.map((article) => ({
			title: article.data.title,
			description: article.data.description,
			pubDate: article.data.publishedDate,
			link: articleHref(article.id),
		})),
	});
}
