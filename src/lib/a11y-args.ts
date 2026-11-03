import { parseArgs } from "node:util";

export interface A11yArgs {
	/** Built site to check, relative to the project root. */
	dir: string;
	/** Only pages whose path starts with this (e.g. `/dev/`); every page when unset. */
	only: string | undefined;
	/** Report file, relative to the project root. */
	report: string;
}

export const DEFAULT_DIR = "dist";
export const DEFAULT_REPORT = "reports/a11y/report.json";

/**
 * Parses `check-a11y.ts`'s command line. Unknown flags and stray positionals
 * throw, so a typo can't silently fall back to checking the whole default
 * build. A literal "--" is dropped: pnpm doesn't always strip its own
 * argument separator before the script sees argv.
 */
export function parseA11yArgs(argv: string[]): A11yArgs {
	const { values } = parseArgs({
		args: argv.filter((arg) => arg !== "--"),
		options: {
			dir: { type: "string", default: DEFAULT_DIR },
			only: { type: "string" },
			report: { type: "string", default: DEFAULT_REPORT },
		},
		strict: true,
		allowPositionals: false,
	});
	// pagePath() yields a leading-slash path, so a prefix without one would
	// match nothing.
	if (values.only !== undefined && !values.only.startsWith("/")) {
		throw new Error(
			`--only must be a path prefix starting with "/" (got ${JSON.stringify(values.only)})`,
		);
	}
	return { dir: values.dir, only: values.only, report: values.report };
}
