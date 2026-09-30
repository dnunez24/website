import { type CollectionEntry, getCollection } from "astro:content";

/** Published articles, newest first. */
export async function getArticles(): Promise<CollectionEntry<"writing">[]> {
	const articles = await getCollection("writing");
	return articles.sort(
		(a, b) => b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf(),
	);
}

export const articleHref = (id: string) => `/writing/${id}/`;

/** Articles per page on `/writing/`. */
export const WRITING_PAGE_SIZE = 10;

export interface WritingPage<T> {
	/** 1-based page number. */
	pageNumber: number;
	/** Total number of pages. */
	total: number;
	/** This page's slice of articles. */
	articles: T[];
	/** This page's own URL. */
	href: string;
}

/** A page's URL: the list itself for page 1, `/writing/page/<n>/` after—so `/writing/page/1/` never exists. */
export const writingPageHref = (pageNumber: number): string =>
	pageNumber === 1 ? "/writing/" : `/writing/page/${pageNumber}/`;

/** Splits sorted articles into pages of `pageSize`. Zero articles still yields one empty page 1. */
export function paginateArticles<T>(
	articles: readonly T[],
	pageSize: number,
): [WritingPage<T>, ...WritingPage<T>[]] {
	const total = Math.max(1, Math.ceil(articles.length / pageSize));
	const page = (pageNumber: number): WritingPage<T> => ({
		pageNumber,
		total,
		articles: articles.slice(
			(pageNumber - 1) * pageSize,
			pageNumber * pageSize,
		),
		href: writingPageHref(pageNumber),
	});
	const rest = Array.from({ length: total - 1 }, (_, index) => page(index + 2));
	return [page(1), ...rest];
}

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
