import { type CollectionEntry, getCollection } from "astro:content";

/** Published articles, newest first. */
export async function getArticles(): Promise<CollectionEntry<"writing">[]> {
	const articles = await getCollection("writing");
	return articles.sort(
		(a, b) => b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf(),
	);
}

export const articleHref = (id: string) => `/writing/${id}/`;

export interface TopicCount {
	name: string;
	count: number;
}

/** Every topic on the given articles with its article count, alphabetical. */
export function countTopics(
	articles: readonly { data: { topics?: string[] | undefined } }[],
): TopicCount[] {
	const counts = new Map<string, number>();
	for (const article of articles) {
		for (const topic of new Set(article.data.topics)) {
			counts.set(topic, (counts.get(topic) ?? 0) + 1);
		}
	}
	return [...counts]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTopics(): Promise<TopicCount[]> {
	return countTopics(await getArticles());
}

// Topic names are slugs (content.config.ts), so the name is the URL segment.
export const topicHref = (name: string) => `/topics/${name}/`;
