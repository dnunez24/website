import { relative } from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * True for a production build, which drops `/dev/*` pages entirely.
 * `excludeDevPages` (astro.config.ts) and the Mermaid Markdown plugin
 * (markdown/mermaid.ts) both read this, so the two can't drift apart on
 * what counts as "a build that drops dev pages".
 */
export const dropsDevPages = (): boolean => import.meta.env.PROD;

/**
 * True when `fileURL` is a specimen page under `src/pages/dev/`, matched by
 * filesystem path relative to the project root rather than by route: a
 * Markdown plugin sees the file it's compiling, not that file's eventual
 * route. A missing `fileURL` is never a dev page.
 */
export const isDevPageFile = (fileURL: URL | undefined): boolean =>
	fileURL !== undefined &&
	relative(process.cwd(), fileURLToPath(fileURL)).startsWith("src/pages/dev/");
