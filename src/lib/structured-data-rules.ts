import type { ExtractedNode } from "@marbec/web-auto-extractor";

export interface StructuredDataIssue {
	/** The page the issue is on, e.g. `/writing/first-post/`. */
	page: string;
	dataFormat: "jsonld" | "microdata" | "rdfa";
	rootType: string;
	severity: "ERROR" | "WARNING";
	issueMessage: string;
	fieldNames?: string[];
}

const nonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.trim() !== "";

function isAbsoluteUrl(value: unknown): boolean {
	if (typeof value !== "string") return false;
	try {
		return /^https?:$/.test(new URL(value).protocol);
	} catch {
		return false;
	}
}

// The exact shape `Date#toISOString` produces, which is how every date
// reaches `seo.ts` (see `articleGraph`). Rejects date-only and non-UTC
// forms too, but nothing in this codebase emits those.
const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isIsoDate = (value: unknown): boolean =>
	typeof value === "string" &&
	ISO_8601_UTC.test(value) &&
	!Number.isNaN(Date.parse(value));

/** Resolves a value that may be an inline node or a bare `{"@id": ...}` reference. */
function resolveNode(
	value: unknown,
	byId: ReadonlyMap<string, ExtractedNode>,
): ExtractedNode | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const node = value as ExtractedNode;
	const id = node["@id"];
	if (typeof id === "string" && byId.has(id)) return byId.get(id);
	return node;
}

const hasType = (node: ExtractedNode, type: string): boolean =>
	node["@type"] === type ||
	(Array.isArray(node["@type"]) && node["@type"].includes(type));

/** The URL string on a BreadcrumbList `item`, inline or `{"@id": ...}`. */
function breadcrumbItemUrl(item: unknown): unknown {
	if (typeof item !== "object" || item === null) return undefined;
	const value = (item as ExtractedNode).item;
	if (typeof value === "object" && value !== null) {
		return (value as ExtractedNode)["@id"];
	}
	return value;
}

/**
 * Field rules per root `@type`, checked against every node of that type on
 * a page. Covers the fields Google's rich results and this site's `seo.ts`
 * depend on — not full schema.org coverage, which the Adobe validator
 * already provides.
 */
const FIELD_RULES: Record<
	string,
	(node: ExtractedNode, byId: ReadonlyMap<string, ExtractedNode>) => string[]
> = {
	BlogPosting: (node) => {
		const issues: string[] = [];
		if (!nonEmptyString(node.headline)) {
			issues.push('"headline" must be non-empty');
		}
		if (!isIsoDate(node.datePublished)) {
			issues.push('"datePublished" must be an ISO 8601 date');
		}
		if (node.dateModified !== undefined && !isIsoDate(node.dateModified)) {
			issues.push('"dateModified" must be an ISO 8601 date');
		}
		if (!isAbsoluteUrl(node.url)) {
			issues.push('"url" must be an absolute URL');
		}
		if (!isAbsoluteUrl(node.image)) {
			issues.push('"image" must be an absolute URL');
		}
		const author = node.author;
		if (
			typeof author !== "object" ||
			author === null ||
			!nonEmptyString((author as ExtractedNode).name)
		) {
			issues.push(
				'"author.name" must be non-empty (author must be an object, not a string)',
			);
		}
		return issues;
	},

	BreadcrumbList: (node) => {
		const issues: string[] = [];
		const items = Array.isArray(node.itemListElement)
			? (node.itemListElement as unknown[])
			: [];
		if (items.length < 2) {
			issues.push('"itemListElement" must have at least 2 items');
		}
		items.forEach((item, index) => {
			if (!isAbsoluteUrl(breadcrumbItemUrl(item))) {
				issues.push(`itemListElement[${index}].item must be an absolute URL`);
			}
			const position =
				typeof item === "object" && item !== null
					? (item as ExtractedNode).position
					: undefined;
			if (typeof position !== "number") {
				issues.push(`itemListElement[${index}] is missing "position"`);
			}
		});
		return issues;
	},

	WebSite: (node) => requireNameAndUrl(node),
	CollectionPage: (node) => requireNameAndUrl(node),

	ProfilePage: (node, byId) => {
		const person = resolveNode(node.mainEntity, byId);
		if (!person || !hasType(person, "Person") || !nonEmptyString(person.name)) {
			return ['"mainEntity" must be a Person with a non-empty "name"'];
		}
		return [];
	},
};

function requireNameAndUrl(node: ExtractedNode): string[] {
	const issues: string[] = [];
	if (!nonEmptyString(node.name)) issues.push('"name" must be non-empty');
	if (!isAbsoluteUrl(node.url)) issues.push('"url" must be an absolute URL');
	return issues;
}

interface RouteRule {
	pattern: RegExp;
	/** Root `@type`s that must all be present in this page's JSON-LD. */
	types: readonly string[];
}

/**
 * Expected root types per route. A page that matches no pattern here fails
 * (see `checkSiteRules`) — add a rule rather than let a new route go
 * unchecked. Keep in sync with `src/lib/seo.ts` and the routes under
 * `src/pages/`.
 */
const ROUTES: readonly RouteRule[] = [
	{ pattern: /^\/$/, types: ["WebSite"] },
	{ pattern: /^\/about\/$/, types: ["ProfilePage"] },
	{ pattern: /^\/writing\/page\/\d+\/$/, types: ["CollectionPage"] },
	{ pattern: /^\/writing\/$/, types: ["CollectionPage"] },
	{ pattern: /^\/writing\/[^/]+\/$/, types: ["BlogPosting", "BreadcrumbList"] },
	{ pattern: /^\/topics\/$/, types: ["CollectionPage"] },
	{ pattern: /^\/topics\/[^/]+\/$/, types: ["CollectionPage"] },
];

/** Not built by this site yet (landing in a parallel PR); `noindex` besides. */
const EXEMPT_PAGES = new Set(["/404.html"]);

/**
 * This site's own structured-data rules: which root `@type`s a route must
 * emit, and the fields on each that Google's rich results (and `seo.ts`'s
 * own consumers) depend on. Runs alongside `@adobe/structured-data-validator`
 * in `validatePage`, not instead of it — the Adobe validator checks the
 * markup is valid schema.org; this checks it's *this site's* structured data.
 */
export function checkSiteRules(
	jsonld: Readonly<Record<string, readonly ExtractedNode[]>>,
	page: string,
): StructuredDataIssue[] {
	if (EXEMPT_PAGES.has(page)) return [];

	const route = ROUTES.find((candidate) => candidate.pattern.test(page));
	if (!route) {
		return [
			{
				page,
				dataFormat: "jsonld",
				rootType: "(page)",
				severity: "ERROR",
				issueMessage: `No structured-data rule for this route. Add one to ROUTES in structured-data-rules.ts.`,
			},
		];
	}

	const byId = new Map<string, ExtractedNode>();
	for (const nodes of Object.values(jsonld)) {
		for (const node of nodes) {
			if (typeof node["@id"] === "string") byId.set(node["@id"], node);
		}
	}

	const issues: StructuredDataIssue[] = [];
	for (const type of route.types) {
		const nodes = jsonld[type] ?? [];
		if (nodes.length === 0) {
			issues.push({
				page,
				dataFormat: "jsonld",
				rootType: type,
				severity: "ERROR",
				issueMessage: `Missing ${type} in structured data`,
			});
			continue;
		}
		const check = FIELD_RULES[type];
		if (!check) continue;
		for (const node of nodes) {
			for (const issueMessage of check(node, byId)) {
				issues.push({
					page,
					dataFormat: "jsonld",
					rootType: type,
					severity: "ERROR",
					issueMessage,
				});
			}
		}
	}
	return issues;
}
