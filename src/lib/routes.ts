/** Navigation marks a link current on its own page and on every page under it. */
export const isCurrentSection = (pathname: string, href: string): boolean =>
	pathname === href ||
	pathname.startsWith(href.endsWith("/") ? href : `${href}/`);

/** Specimen pages under `/dev/` are for local development; production builds drop them. */
export const isDevRoute = (pathname: string): boolean =>
	pathname.startsWith("/dev/");

/** `@astrojs/sitemap` filter: excludes the dev routes the build drops, which would otherwise ship as 404s. `@astrojs/sitemap` already excludes status-code pages like `/404` itself. */
export const isPublicPage = (page: string): boolean =>
	!isDevRoute(new URL(page).pathname);
