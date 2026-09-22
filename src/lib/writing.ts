import { type CollectionEntry, getCollection } from "astro:content";

/** Published articles, newest first. */
export async function getArticles(): Promise<CollectionEntry<"writing">[]> {
	const articles = await getCollection("writing");
	return articles.sort(
		(a, b) => b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf(),
	);
}

export const articleHref = (id: string) => `/writing/${id}/`;
