// Usage: node route-guard.mjs <path-to-wrangler.jsonc> [expectedTopLevelName]
//
// Run by every *-deploy job in ../workflows/deploy.yml before it installs
// wrangler. Refuses to run if the top level of wrangler.jsonc has a route or
// routes key (only env.production should ever carry the custom domain), and
// optionally asserts the top-level name field. Pass expectedTopLevelName for
// preview/staging ("website"); omit it for production, since production's
// resolved name ("website-production") comes from env-name derivation, not
// a literal field in the file — production-deploy checks that separately,
// against wrangler's own --dry-run output.
//
// wrangler.jsonc is JSONC, and wrangler's own parser tolerates trailing
// commas and comments. An earlier version of this guard used `sed` to strip
// `//` comments and jq to check the result — a trailing comma or a `/* */`
// comment made jq fail to parse, and the calling script's `if jq -e ...`
// treated that parse failure as "the key isn't there", silently passing a
// config that could have deployed production traffic. This version strips
// JSONC (// line comments, /* block */ comments, trailing commas) down to
// strict JSON, string-aware so a "//" or "," inside a string value is never
// touched, then JSON.parse()s the result — any failure anywhere in this
// file throws and exits non-zero, so a config problem fails the job closed
// instead of silently reading as "no route key found".
function stripJsonc(text) {
	let out = "";
	let i = 0;
	const n = text.length;
	while (i < n) {
		const c = text[i];
		if (c === '"') {
			// Copy the whole string literal verbatim, honoring escapes, so
			// nothing inside it is ever mistaken for a comment or a comma.
			out += c;
			i++;
			while (i < n) {
				const sc = text[i];
				out += sc;
				if (sc === "\\" && i + 1 < n) {
					out += text[i + 1];
					i += 2;
					continue;
				}
				i++;
				if (sc === '"') break;
			}
			continue;
		}
		if (c === "/" && text[i + 1] === "/") {
			while (i < n && text[i] !== "\n") i++;
			continue;
		}
		if (c === "/" && text[i + 1] === "*") {
			i += 2;
			while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
			i += 2;
			continue;
		}
		out += c;
		i++;
	}
	// Trailing commas: a "," is only ever a JSON separator outside strings
	// at this point (strings were copied verbatim above), so it's safe to
	// remove one that's immediately followed by a closing bracket.
	out = out.replace(/,(\s*[}\]])/g, "$1");
	return JSON.parse(out);
}

const fs = await import("node:fs");
const path = process.argv[2];
const expectedName = process.argv[3];
const text = fs.readFileSync(path, "utf8");

let config;
try {
	config = stripJsonc(text);
} catch (err) {
	console.error(`::error::Could not parse ${path} as JSONC: ${err.message}`);
	process.exit(1);
}

if (Object.hasOwn(config, "route") || Object.hasOwn(config, "routes")) {
	console.error(
		`::error::${path} has a top-level route or routes key. This deploy target must never carry a custom domain or zone route.`,
	);
	process.exit(1);
}

if (expectedName !== undefined && config.name !== expectedName) {
	console.error(
		`::error::${path}'s top-level name is ${JSON.stringify(config.name)}, expected ${JSON.stringify(expectedName)}.`,
	);
	process.exit(1);
}

console.log("ok");
