import {
	FOOTER_NAV_ITEMS,
	SITE_DESCRIPTION,
	SITE_TAGLINE,
	SITE_TITLE,
} from "@constants";
import type {
	BlogPosting,
	BreadcrumbList,
	CollectionPage,
	Graph,
	Person,
	ProfilePage,
	WebSite,
} from "schema-dts";

/** A share card: the image a page shows when it's shared, and its alt text. */
export interface ShareImage {
	path: string;
	alt: string;
}

/** The default card, for every page but articles. Drawn at build by `src/pages/og/default.png.ts`. */
export const SHARE_IMAGE = {
	path: "/og/default.png",
	type: "image/png",
	width: 1200,
	height: 630,
	alt: `${SITE_TITLE}: ${SITE_TAGLINE}`,
} as const;

/** An article's own card. Drawn at build by `src/pages/og/writing/[...slug].png.ts`. */
export const articleShareImage = (
	id: string,
	title: string,
	subtitle?: string,
): ShareImage => ({
	path: `/og/writing/${id}.png`,
	alt: subtitle ? `${title}: ${subtitle}` : title,
});

/** "Writing — Dave Nuñez"; the home page's title is the name alone. */
export const pageTitle = (title: string) =>
	title === SITE_TITLE ? title : `${title} — ${SITE_TITLE}`;

/** Profiles that are the same person as this site: `rel="me"` links and `sameAs`. */
export const PROFILES = FOOTER_NAV_ITEMS.filter(
	(item) => "rel" in item && item.rel === "me",
).map((item) => item.href);

const absolute = (path: string, site: URL) => new URL(path, site).href;

/** The site's author, referenced by `@id` from the other nodes on a page. */
export function person(site: URL): Person {
	return {
		"@type": "Person",
		"@id": absolute("/#person", site),
		name: SITE_TITLE,
		url: absolute("/", site),
		sameAs: PROFILES,
	};
}

const website = (site: URL): WebSite => ({
	"@type": "WebSite",
	"@id": absolute("/#website", site),
	name: SITE_TITLE,
	url: absolute("/", site),
	description: SITE_DESCRIPTION,
	inLanguage: "en",
	author: { "@id": absolute("/#person", site) },
});

const graph = (...nodes: Graph["@graph"]): Graph => ({
	"@context": "https://schema.org",
	"@graph": nodes,
});

/** Home: the site and its author. */
export const homeGraph = (site: URL) => graph(website(site), person(site));

/** About: a profile page about the author. */
export function profileGraph(site: URL, path: string): Graph {
	const page: ProfilePage = {
		"@type": "ProfilePage",
		url: absolute(path, site),
		name: pageTitle("About"),
		isPartOf: { "@id": absolute("/#website", site) },
		mainEntity: { "@id": absolute("/#person", site) },
	};
	return graph(page, website(site), person(site));
}

/** Writing, Topics and each topic: a page that lists articles. */
export function collectionGraph(
	site: URL,
	path: string,
	name: string,
	description: string,
): Graph {
	const page: CollectionPage = {
		"@type": "CollectionPage",
		url: absolute(path, site),
		name: pageTitle(name),
		description,
		isPartOf: { "@id": absolute("/#website", site) },
	};
	return graph(page, website(site));
}

export interface ArticleData {
	title: string;
	subtitle?: string | undefined;
	description: string;
	publishedDate: Date;
	updatedDate?: Date | undefined;
	topics?: string[] | undefined;
}

/** An article, with the breadcrumb Home › Writing › the article. */
export function articleGraph(
	site: URL,
	path: string,
	article: ArticleData,
	image: Pick<ShareImage, "path"> = SHARE_IMAGE,
): Graph {
	const url = absolute(path, site);
	const posting: BlogPosting = {
		"@type": "BlogPosting",
		headline: article.title,
		...(article.subtitle ? { alternativeHeadline: article.subtitle } : {}),
		description: article.description,
		url,
		mainEntityOfPage: url,
		datePublished: article.publishedDate.toISOString(),
		dateModified: (article.updatedDate ?? article.publishedDate).toISOString(),
		author: { "@type": "Person", name: SITE_TITLE, url: absolute("/", site) },
		image: absolute(image.path, site),
		inLanguage: "en",
		...(article.topics?.length ? { keywords: article.topics } : {}),
		isPartOf: { "@id": absolute("/#website", site) },
	};
	const breadcrumbs: BreadcrumbList = {
		"@type": "BreadcrumbList",
		itemListElement: [
			{ name: SITE_TITLE, path: "/" },
			{ name: "Writing", path: "/writing/" },
			{ name: article.title, path },
		].map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: absolute(crumb.path, site),
		})),
	};
	return graph(posting, breadcrumbs, website(site));
}
