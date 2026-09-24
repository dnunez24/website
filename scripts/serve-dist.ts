/**
 * Serves `dist/` the way Workers will (see `src/lib/dist-server.ts`), and
 * keeps running until killed. Used directly for a quick look, and as
 * Lighthouse CI's `startServerCommand` (see `lighthouserc.cjs`) so perf
 * numbers reflect the real trailing-slash and 404 behavior, not
 * `astro preview` or LHCI's own static server.
 *
 *   pnpm serve:dist            # port 4173
 *   pnpm serve:dist -- <port>
 *
 * Requires Node >= 22.18, which runs TypeScript without a build step.
 */

import { access } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { startDistServer } from "../src/lib/dist-server.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = join(ROOT, "dist");

// Matches lighthouserc.cjs's PORT, so `pnpm serve:dist` alone works too.
const DEFAULT_PORT = 4173;

// pnpm's `--` arg separator doesn't always get stripped before this process
// sees argv (depends how the command was invoked — LHCI's startServerCommand
// hits this), so tolerate a literal "--" instead of relying on that.
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const port = args[0] === undefined ? DEFAULT_PORT : Number(args[0]);
if (!Number.isInteger(port) || port <= 0) {
	throw new Error(
		`Usage: pnpm serve:dist [-- <port>] (got ${JSON.stringify(args[0])})`,
	);
}

try {
	await access(DIST_DIR);
} catch {
	throw new Error(
		`No ${relative(ROOT, DIST_DIR)} directory. Run \`pnpm build\` first.`,
	);
}

const server = await startDistServer(DIST_DIR, port);
// Matched by lighthouserc.cjs's startServerReadyPattern: keep them in sync.
console.log(`Listening on ${server.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		server.close().then(() => process.exit(0));
	});
}
