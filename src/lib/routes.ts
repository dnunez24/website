/** The `aria-current` value a nav link should carry, or `undefined` for neither. */
export type CurrentState = "page" | "true" | undefined;

/**
 * One trailing slash off, so "/writing" and "/writing/" compare the same
 * way regardless of which side has it. "/" has no non-slash prefix to
 * strip: stripping it would make "/" a prefix of every path.
 */
const withoutTrailingSlash = (path: string): string =>
	path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

/**
 * Navigation marks the link to the exact current page `"page"`, and the
 * link to the section a page sits in `"true"` (an ancestor match, such as
 * an article under `/writing/`, a later writing page, or a topic under
 * `/topics/`). A link that only shares a prefix, or an external URL,
 * matches neither. `href="/"` matches only the home page itself: without
 * the exact-match guard, every path starts with "/", so a nav link to
 * `/` would read `"true"` everywhere.
 */
export const currentNavState = (
	pathname: string,
	href: string,
): CurrentState => {
	const normalizedPathname = withoutTrailingSlash(pathname);
	const normalizedHref = withoutTrailingSlash(href);
	if (normalizedPathname === normalizedHref) return "page";
	return normalizedHref !== "/" &&
		normalizedPathname.startsWith(`${normalizedHref}/`)
		? "true"
		: undefined;
};

/** Specimen pages under `/dev/` are for local development; production builds drop them. */
export const isDevRoute = (pathname: string): boolean =>
	pathname.startsWith("/dev/");

/** `@astrojs/sitemap` filter: excludes the dev routes the build drops, which would otherwise ship as 404s. `@astrojs/sitemap` already excludes status-code pages like `/404` itself. */
export const isPublicPage = (page: string): boolean =>
	!isDevRoute(new URL(page).pathname);

/**
 * True for a production build, which drops `/dev/*` pages entirely, unless
 * `keepDevPages` (`DN_DEV_PAGES=1`, read once in astro.config.ts) keeps them.
 * `excludeDevPages` (astro.config.ts) reads this, so what counts as "a build
 * that drops dev pages" has one definition.
 */
export const dropsDevPages = (keepDevPages = false): boolean =>
	import.meta.env.PROD && !keepDevPages;
