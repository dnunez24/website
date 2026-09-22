import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import ArticleList from "./ArticleList.astro";
import BlockQuote from "./BlockQuote.astro";
import Button from "./Button.astro";
import CodeBlock from "./CodeBlock.astro";
import FormattedDate from "./FormattedDate.astro";
import Header from "./Header.astro";
import Link from "./Link.astro";
import Pagination from "./Pagination.astro";
import SectionHeading from "./SectionHeading.astro";
import SectionTitle from "./SectionTitle.astro";
import Topic from "./Topic.astro";

let container: AstroContainer;

beforeAll(async () => {
	container = await AstroContainer.create();
});

const render = (
	component: Parameters<AstroContainer["renderToString"]>[0],
	options: Parameters<AstroContainer["renderToString"]>[1] = {},
) => container.renderToString(component, options);

/**
 * Parses rendered HTML so assertions read attributes, not string fragments.
 * Only the parser comes from happy-dom: a happy-dom test environment makes
 * Vitest compile `.astro` files for the client, which can't render them.
 */
const { DOMParser } = new Window();
const parse = (html: string) =>
	new DOMParser().parseFromString(html, "text/html") as unknown as Document;

describe("Button", () => {
	it("renders a button with type=button when there is no href", async () => {
		const doc = parse(
			await render(Button, { slots: { default: "Subscribe" } }),
		);
		const button = doc.querySelector("button");
		expect(button?.getAttribute("type")).toBe("button");
		expect(button?.textContent?.trim()).toBe("Subscribe");
	});

	it("renders a link when given an href", async () => {
		const doc = parse(
			await render(Button, {
				props: { href: "/writing" },
				slots: { default: "Writing" },
			}),
		);
		expect(doc.querySelector("a")?.getAttribute("href")).toBe("/writing");
		expect(doc.querySelector("button")).toBeNull();
	});

	it("marks the current page on a ghost button", async () => {
		const doc = parse(
			await render(Button, {
				props: { href: "/about", variant: "ghost", current: true },
				slots: { default: "About" },
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("aria-current")).toBe("page");
		expect(link?.className).toContain("font-bold");
	});

	it.each(["filled", "outline", "ghost"] as const)(
		"applies the %s variant",
		async (variant) => {
			const doc = parse(
				await render(Button, { props: { variant }, slots: { default: "Go" } }),
			);
			const classes = doc.querySelector("button")?.className ?? "";
			const expected = {
				filled: "bg-brand",
				outline: "border-brand",
				ghost: "hover:bg-surface-hover",
			};
			expect(classes).toContain(expected[variant]);
		},
	);
});

describe("Link", () => {
	it("adds the external mark and rel to absolute URLs", async () => {
		const doc = parse(
			await render(Link, {
				props: { href: "https://example.org" },
				slots: { default: "Out" },
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("rel")).toBe("external");
		expect(link?.className).toContain("link-external");
	});

	it("leaves internal links unmarked", async () => {
		const doc = parse(
			await render(Link, {
				props: { href: "/about" },
				slots: { default: "In" },
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.hasAttribute("rel")).toBe(false);
		expect(link?.className).not.toContain("link-external");
	});
});

describe("FormattedDate", () => {
	it("renders the UTC calendar date with a machine-readable datetime", async () => {
		const doc = parse(
			await render(FormattedDate, { props: { date: new Date("2026-08-21") } }),
		);
		const time = doc.querySelector("time");
		expect(time?.getAttribute("datetime")).toBe("2026-08-21");
		expect(time?.textContent).toBe("Aug 21, 2026");
		expect(time?.className).toContain("uppercase");
	});
});

describe("Topic", () => {
	it("hides the # from assistive technology and shows the count", async () => {
		const doc = parse(
			await render(Topic, {
				props: { name: "systems", href: "/topics/systems", count: 9 },
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/topics/systems");
		expect(link?.querySelector('[aria-hidden="true"]')?.textContent).toBe("#");
		expect(link?.textContent).toBe("#systems9");
	});

	it("renders a non-link topic without a hover state", async () => {
		const doc = parse(await render(Topic, { props: { name: "craft" } }));
		expect(doc.querySelector("a")).toBeNull();
		expect(doc.querySelector("span")?.className).not.toContain("hover:");
	});
});

describe("Header", () => {
	it("marks only the current section in the navigation", async () => {
		const doc = parse(
			await render(Header, {
				request: new Request("https://example.com/writing/some-article/"),
			}),
		);
		const current = [...doc.querySelectorAll('nav a[aria-current="page"]')];
		expect(current.map((link) => link.getAttribute("href"))).toEqual([
			"/writing",
		]);
		expect(doc.querySelector("nav")?.getAttribute("aria-label")).toBe("Main");
	});

	it("marks nothing on the home page", async () => {
		const doc = parse(
			await render(Header, { request: new Request("https://example.com/") }),
		);
		expect(doc.querySelectorAll("[aria-current]")).toHaveLength(0);
	});
});

describe("Pagination", () => {
	const href = (page: number) => `/writing/${page}/`;
	const pages = (doc: Document) =>
		[...doc.querySelectorAll("ol li")].map((item) => item.textContent?.trim());

	it("shows first, last, neighbors and gaps around a middle page", async () => {
		const doc = parse(
			await render(Pagination, { props: { current: 5, total: 12, href } }),
		);
		expect(pages(doc)).toEqual(["1", "…", "4", "5", "6", "…", "12"]);
		expect(
			doc.querySelector('[aria-current="page"]')?.getAttribute("aria-label"),
		).toBe("Page 5");
		expect(doc.querySelector('a[rel="prev"]')?.getAttribute("href")).toBe(
			"/writing/4/",
		);
		expect(doc.querySelector('a[rel="next"]')?.getAttribute("href")).toBe(
			"/writing/6/",
		);
	});

	it("omits the previous link on the first page and next on the last", async () => {
		const first = parse(
			await render(Pagination, { props: { current: 1, total: 3, href } }),
		);
		expect(first.querySelector('a[rel="prev"]')).toBeNull();
		expect(pages(first)).toEqual(["1", "2", "3"]);

		const last = parse(
			await render(Pagination, { props: { current: 3, total: 3, href } }),
		);
		expect(last.querySelector('a[rel="next"]')).toBeNull();
	});

	it("labels the landmark", async () => {
		const doc = parse(
			await render(Pagination, { props: { current: 1, total: 2, href } }),
		);
		expect(doc.querySelector("nav")?.getAttribute("aria-label")).toBe(
			"Pagination",
		);
	});
});

describe("ArticleList", () => {
	it("renders date, title link and optional summary per article", async () => {
		const doc = parse(
			await render(ArticleList, {
				props: {
					articles: [
						{
							title: "First",
							href: "/writing/first/",
							date: new Date("2026-01-02"),
							summary: "One.",
						},
						{
							title: "Second",
							href: "/writing/second/",
							date: new Date("2025-03-04"),
						},
					],
				},
			}),
		);
		const items = doc.querySelectorAll("ol > li");
		expect(items).toHaveLength(2);
		expect(items[0]?.querySelector("time")?.getAttribute("datetime")).toBe(
			"2026-01-02",
		);
		expect(items[0]?.querySelector("a")?.getAttribute("href")).toBe(
			"/writing/first/",
		);
		expect(items[0]?.querySelector("p")?.textContent).toBe("One.");
		expect(items[1]?.querySelector("p")).toBeNull();
	});
});

describe("BlockQuote", () => {
	it("puts the author and an upright work title in the footer", async () => {
		const doc = parse(
			await render(BlockQuote, {
				props: { author: "Charles Eames", source: "Design Q&A" },
				slots: { default: "<p>Recognizing the need.</p>" },
			}),
		);
		expect(doc.querySelector("blockquote footer")?.textContent).toBe(
			"Charles Eames, Design Q&A",
		);
		expect(doc.querySelector("blockquote footer cite")?.textContent).toBe(
			"Design Q&A",
		);
	});
});

describe("CodeBlock", () => {
	it("highlights with syntax tokens and shows file and language", async () => {
		const doc = parse(
			await render(CodeBlock, {
				props: { code: "const answer = 42;", lang: "ts", file: "answer.ts" },
			}),
		);
		expect(doc.querySelector("[data-codeblock]")?.textContent).toContain(
			"answer.ts",
		);
		const html = doc.querySelector("pre")?.outerHTML ?? "";
		expect(html).toContain("var(--color-syntax-keyword)");
		expect(html).toContain("font-weight:600");
		expect(html).not.toContain("font-weight:bold");
	});
});

describe.each([
	["SectionHeading", SectionHeading],
	["SectionTitle", SectionTitle],
] as const)("%s", (_, Component) => {
	it("merges the caller's class with its own", async () => {
		const doc = parse(
			await render(Component, {
				props: { class: "f6y-mt-8", id: "x" },
				slots: { default: "Title" },
			}),
		);
		const heading = doc.querySelector("h2");
		expect(heading?.classList.contains("f6y-mt-8")).toBe(true);
		expect(
			heading?.classList.contains("font-mono") ||
				heading?.classList.contains("font-sans"),
		).toBe(true);
		expect(heading?.id).toBe("x");
	});

	it("sets no top margin of its own", async () => {
		const doc = parse(await render(Component, { slots: { default: "Title" } }));
		const classes = [...(doc.querySelector("h2")?.classList ?? [])];
		expect(classes.filter((name) => /^(f6y-)?(m|my|mt)-/.test(name))).toEqual(
			[],
		);
	});
});
