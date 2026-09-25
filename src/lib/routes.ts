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

const PAGES_DIR = "src/pages/";

/**
 * True when a path relative to `src/pages/` names `/dev` or a page under it
 * — agreeing with `isDevRoute`'s route-based check, not just the directory:
 * a page's file extension becomes its route, so `dev.md` routes to `/dev/`,
 * same as anything under a `dev/` directory, while `devices.md` doesn't.
 * Backslashes are normalized to `/` first, so a relative path computed on
 * Windows (`dev\x.md`) matches too.
 */
export const isDevPagePath = (pathFromPagesDir: string): boolean => {
	const [first, ...rest] = pathFromPagesDir.replaceAll("\\", "/").split("/");
	return rest.length > 0
		? first === "dev"
		: first?.replace(/\.[^.]*$/, "") === "dev";
};

/**
 * True when `fileURL` is a specimen page under `src/pages/dev/` (or the
 * file `src/pages/dev.*`), matched by filesystem path relative to `root`
 * rather than by route: a Markdown plugin sees the file it's compiling, not
 * that file's eventual route. `root` is the project root — the directory
 * holding `astro.config.ts` — which callers must pass explicitly rather
 * than assume from `process.cwd()`: `astro build --root <path>` points
 * Astro at the project without moving the working directory. A missing or
 * non-`file:` `fileURL` is never a dev page.
 */
export const isDevPageFile = (fileURL: URL | undefined, root: URL): boolean => {
	if (fileURL === undefined || fileURL.protocol !== "file:") return false;
	const relativePath = relative(
		fileURLToPath(root),
		fileURLToPath(fileURL),
	).replaceAll("\\", "/");
	return (
		relativePath.startsWith(PAGES_DIR) &&
		isDevPagePath(relativePath.slice(PAGES_DIR.length))
	);
};
