/** Specimen pages under `/dev/` are for local development; production builds drop them. */
export const isDevRoute = (pathname: string): boolean =>
	pathname.startsWith("/dev/");

/**
 * `@astrojs/sitemap` filter. The sitemap lists every route, including the
 * dev routes the build drops, so they would otherwise ship as 404s.
 */
export const isPublicPage = (page: string): boolean =>
	!isDevRoute(new URL(page).pathname);
