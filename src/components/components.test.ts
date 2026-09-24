import { experimental_AstroContainer as AstroContainer } from "astro/container";
import type { ComponentProps } from "astro/types";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import ArticleList from "./ArticleList.astro";
import BlockQuote from "./BlockQuote.astro";
import Button from "./Button.astro";
import CloudflareAnalytics from "./CloudflareAnalytics.astro";
import CodeBlock from "./CodeBlock.astro";
import Container from "./Container.astro";
import Copyright from "./Copyright.astro";
import Figure from "./Figure.astro";
import Footer from "./Footer.astro";
import FormattedDate from "./FormattedDate.astro";
import Header from "./Header.astro";
import JsonLd from "./JsonLd.astro";
import Link from "./Link.astro";
import MermaidDiagram from "./MermaidDiagram.astro";
import PageMeta from "./PageMeta.astro";
import PageTitle from "./PageTitle.astro";
import Pagination from "./Pagination.astro";
import Portrait from "./Portrait.astro";
import Prose from "./Prose.astro";
import SectionHeading from "./SectionHeading.astro";
import SectionTitle from "./SectionTitle.astro";
import SkipLink from "./SkipLink.astro";
import Topic from "./Topic.astro";
import TopicList from "./TopicList.astro";
import WordMark from "./WordMark.astro";
import WritingList from "./WritingList.astro";

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
				props: { href: "/about", variant: "ghost", current: "page" },
				slots: { default: "About" },
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("aria-current")).toBe("page");
		expect(link?.className).toContain("font-bold");
	});

	it("marks the current section true, with the same styling as the current page", async () => {
		const doc = parse(
			await render(Button, {
				props: { href: "/writing/", variant: "ghost", current: "true" },
				slots: { default: "Writing" },
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("aria-current")).toBe("true");
		expect(link?.className).toContain("font-bold");
		expect(link?.className).toContain("text-brand");
	});

	it("draws the current page's rule in the label's color and hides it on hover", async () => {
		const doc = parse(
			await render(Button, {
				props: { href: "/about", variant: "ghost", current: "page" },
				slots: { default: "About" },
			}),
		);
		const classes = doc.querySelector("a")?.classList;
		expect(classes).toContain("text-brand");
		expect(classes).toContain("after:bg-current");
		expect(classes).toContain("hover:after:opacity-0");
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
	it("hides the # from assistive technology", async () => {
		const doc = parse(
			await render(Topic, {
				props: { name: "systems", href: "/topics/systems" },
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/topics/systems");
		expect(link?.querySelector('[aria-hidden="true"]')?.textContent).toBe("#");
		expect(link?.textContent).toBe("#systems");
	});

	it("keeps the # at the name's full color, not dimmed or recolored", async () => {
		const doc = parse(
			await render(Topic, {
				props: { name: "systems", href: "/topics/systems" },
			}),
		);
		// No class at all: neither an opacity utility nor a different text color
		// than the inherited `text-topic` the link sets.
		expect(
			doc.querySelector('[aria-hidden="true"]')?.getAttribute("class"),
		).toBeNull();
	});

	it("shows only the count's number and reads it as articles", async () => {
		const link = async (count: number) =>
			parse(
				await render(Topic, {
					props: { name: "systems", href: "/topics/systems", count },
				}),
			).querySelector("a");
		const nine = await link(9);
		expect(nine?.textContent).toBe("#systems, 9 articles");
		expect(
			[...(nine?.querySelectorAll(".sr-only") ?? [])].map(
				(hidden) => hidden.textContent,
			),
		).toEqual([", ", " articles"]);
		expect((await link(1))?.textContent).toBe("#systems, 1 article");
	});

	it("renders a non-link topic without a hover state", async () => {
		const doc = parse(
			await render(Topic, { props: { name: "craft", count: 6 } }),
		);
		expect(doc.querySelector("a")).toBeNull();
		expect(doc.body.innerHTML).not.toContain("hover:");
	});
});

describe("Header", () => {
	it('marks the exact current page "page"', async () => {
		const doc = parse(
			await render(Header, {
				request: new Request("https://example.com/writing/"),
			}),
		);
		const current = [...doc.querySelectorAll('nav a[aria-current="page"]')];
		expect(current.map((link) => link.getAttribute("href"))).toEqual([
			"/writing/",
		]);
		expect(doc.querySelector("nav")?.getAttribute("aria-label")).toBe(
			"Primary",
		);
	});

	it('marks the section "true" on a page inside it, not "page"', async () => {
		const doc = parse(
			await render(Header, {
				request: new Request("https://example.com/writing/some-article/"),
			}),
		);
		expect(doc.querySelectorAll('nav a[aria-current="page"]')).toHaveLength(0);
		const section = [...doc.querySelectorAll('nav a[aria-current="true"]')];
		expect(section.map((link) => link.getAttribute("href"))).toEqual([
			"/writing/",
		]);
	});

	it("opens with the skip link, before the word mark", async () => {
		const doc = parse(
			await render(Header, { request: new Request("https://example.com/") }),
		);
		const [skip, wordmark] = doc.querySelectorAll("header a");
		expect(skip?.getAttribute("href")).toBe("#main");
		expect(skip?.textContent?.trim()).toBe("Skip to content");
		// The focused skip link stands in for the WordMark, which fades.
		expect(skip?.classList).toContain("peer");
		expect(wordmark?.classList).toContain("peer-focus-visible:opacity-0");
	});

	it("marks nothing on the home page", async () => {
		const doc = parse(
			await render(Header, { request: new Request("https://example.com/") }),
		);
		expect(doc.querySelectorAll("[aria-current]")).toHaveLength(0);
	});

	it("marks nothing on the 404 page", async () => {
		const doc = parse(
			await render(Header, { request: new Request("https://example.com/404") }),
		);
		expect(doc.querySelectorAll("[aria-current]")).toHaveLength(0);
	});
});

describe("Footer", () => {
	const currentState = async (url: string) => {
		const doc = parse(await render(Footer, { request: new Request(url) }));
		return doc
			.querySelector('nav a[href="/topics/"]')
			?.getAttribute("aria-current");
	};

	it('marks Topics "page" on the Topics page and "true" on every topic page', async () => {
		expect(await currentState("https://example.com/topics/")).toBe("page");
		expect(await currentState("https://example.com/topics/systems/")).toBe(
			"true",
		);
		expect(await currentState("https://example.com/writing/")).toBeNull();
	});

	it("marks nothing on the 404 page", async () => {
		const doc = parse(
			await render(Footer, { request: new Request("https://example.com/404") }),
		);
		expect(doc.querySelectorAll("[aria-current]")).toHaveLength(0);
	});

	it("marks the LinkedIn and GitHub profiles as the same person", async () => {
		const doc = parse(
			await render(Footer, { request: new Request("https://example.com/") }),
		);
		const rels = [...doc.querySelectorAll("nav a")].map(
			(link) => `${link.textContent?.trim()}:${link.getAttribute("rel") ?? ""}`,
		);
		expect(rels).toEqual(["Topics:", "LinkedIn:me", "GitHub:me", "RSS:"]);
	});

	it("labels its navigation Secondary and ends with the copyright", async () => {
		const doc = parse(
			await render(Footer, { request: new Request("https://example.com/") }),
		);
		expect(doc.querySelector("nav")?.getAttribute("aria-label")).toBe(
			"Secondary",
		);
		// Stacked and centered below the measure breakpoint, one row from it.
		const layout = doc.querySelector("footer > div")?.classList;
		expect(layout).toContain("flex-col");
		expect(layout).toContain("text-center");
		expect(layout).toContain("measure:flex-row");
		// The first year is 2026, so later builds show a range starting there.
		expect(doc.querySelector("footer p")?.textContent).toMatch(
			/^© 2026(–\d{4})? Dave Nuñez\. All rights reserved\.$/,
		);
	});
});

describe("PageMeta", () => {
	const meta = async (props: Record<string, unknown>, url: string) => {
		const doc = parse(
			await render(PageMeta, { props, request: new Request(url) }),
		);
		const content = (key: string) =>
			[
				...doc.querySelectorAll(`meta[property="${key}"], meta[name="${key}"]`),
			].map((tag) => tag.getAttribute("content"));
		return { doc, content };
	};

	it("titles the page, links the canonical URL and shares the card", async () => {
		const { doc, content } = await meta(
			{ title: "Writing", description: "Everything I have written." },
			"https://davidanunez.com/writing/",
		);
		expect(doc.querySelector("title")?.textContent).toBe(
			"Writing — Dave Nuñez",
		);
		expect(
			doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
		).toBe("https://davidanunez.com/writing/");
		expect(content("og:type")).toEqual(["website"]);
		expect(content("og:url")).toEqual(["https://davidanunez.com/writing/"]);
		expect(content("og:image")).toEqual([
			"https://davidanunez.com/og/default.png",
		]);
		expect(content("og:image:width")).toEqual(["1200"]);
		expect(content("og:image:height")).toEqual(["630"]);
		expect(content("og:image:alt")).toEqual([
			"Dave Nuñez: Leader / Builder / Integrator",
		]);
		expect(content("twitter:card")).toEqual(["summary_large_image"]);
		expect(content("article:published_time")).toEqual([]);
	});

	it("omits the robots meta tag by default", async () => {
		const { doc } = await meta(
			{ title: "Writing", description: "Everything I have written." },
			"https://davidanunez.com/writing/",
		);
		expect(doc.querySelector('meta[name="robots"]')).toBeNull();
	});

	it("adds noindex and drops the canonical link and og:url when noindex is set", async () => {
		const { doc, content } = await meta(
			{
				title: "Page not found",
				description: "I couldn’t find that page.",
				noindex: true,
			},
			"https://davidanunez.com/404",
		);
		expect(
			doc.querySelector('meta[name="robots"]')?.getAttribute("content"),
		).toBe("noindex");
		// Every missing path serves this page, so it has no URL of its own for
		// a canonical link or og:url to point to.
		expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
		expect(content("og:url")).toEqual([]);
	});

	it("shares an article's own card", async () => {
		const { content } = await meta(
			{
				title: "First post",
				description: "Lorem ipsum.",
				image: {
					path: "/og/writing/first-post.png",
					alt: "First post: On beginnings",
				},
			},
			"https://davidanunez.com/writing/first-post/",
		);
		expect(content("og:image")).toEqual([
			"https://davidanunez.com/og/writing/first-post.png",
		]);
		expect(content("og:image:alt")).toEqual(["First post: On beginnings"]);
		expect(content("twitter:image:alt")).toEqual(["First post: On beginnings"]);
	});

	it("adds an article's dates and topics", async () => {
		const { content } = await meta(
			{
				title: "First post",
				description: "Lorem ipsum.",
				article: {
					publishedDate: new Date("2022-07-08T00:00:00Z"),
					updatedDate: new Date("2022-08-01T00:00:00Z"),
					topics: ["systems", "architecture"],
				},
			},
			"https://davidanunez.com/writing/first-post/",
		);
		expect(content("og:type")).toEqual(["article"]);
		expect(content("article:published_time")).toEqual([
			"2022-07-08T00:00:00.000Z",
		]);
		expect(content("article:modified_time")).toEqual([
			"2022-08-01T00:00:00.000Z",
		]);
		expect(content("article:tag")).toEqual(["systems", "architecture"]);
	});
});

describe("JsonLd", () => {
	it("writes the graph as JSON-LD and escapes a closing script tag", async () => {
		const html = await render(JsonLd, {
			props: {
				data: {
					"@context": "https://schema.org",
					"@graph": [{ "@type": "Thing", name: "</script><b>" }],
				},
			},
		});
		expect(html).toContain('<script type="application/ld+json">');
		expect(html).not.toContain("</script><b>");
		const json = html.replace(/^.*?>/s, "").replace(/<\/script>\s*$/, "");
		expect(JSON.parse(json)["@graph"][0].name).toBe("</script><b>");
	});
});

describe("CloudflareAnalytics", () => {
	const TOKEN = "0123456789abcdef0123456789abcdef";

	it("renders nothing without a token", async () => {
		const doc = parse(await render(CloudflareAnalytics, { props: {} }));
		expect(doc.querySelector("script")).toBeNull();
	});

	it("renders exactly one beacon script and no preconnect with a token", async () => {
		const doc = parse(
			await render(CloudflareAnalytics, { props: { token: TOKEN } }),
		);
		const scripts = doc.querySelectorAll("script");
		expect(scripts).toHaveLength(1);
		expect(scripts[0]?.getAttribute("type")).toBe("module");
		expect(scripts[0]?.getAttribute("src")).toBe(
			"https://static.cloudflareinsights.com/beacon.min.js",
		);
		expect(
			JSON.parse(scripts[0]?.getAttribute("data-cf-beacon") ?? ""),
		).toEqual({ token: TOKEN });
		// No preconnect: a module script fetches cross-origin without
		// credentials, so an uncredentialed preconnect would open a second,
		// unused connection — and the script is the very next element anyway.
		expect(doc.querySelector("link")).toBeNull();
	});
});

describe("Copyright", () => {
	const text = async (props: Record<string, unknown>) =>
		parse(
			await render(Copyright, { props: { name: "Dave Nuñez", ...props } }),
		).querySelector("p")?.textContent;

	it("shows one year until the build year passes the first year", async () => {
		expect(await text({ since: 2026, year: 2026 })).toBe("© 2026 Dave Nuñez");
		expect(await text({ since: 2027, year: 2026 })).toBe("© 2026 Dave Nuñez");
	});

	it("shows a range after the first year, joined by an en dash", async () => {
		expect(await text({ since: 2024, year: 2026 })).toBe(
			"© 2024–2026 Dave Nuñez",
		);
	});

	it("adds the notice after a period, wrapping as a unit", async () => {
		const doc = parse(
			await render(Copyright, {
				props: {
					name: "Dave Nuñez",
					since: 2024,
					year: 2026,
					rightsReserved: true,
				},
			}),
		);
		expect(doc.querySelector("p")?.textContent).toBe(
			"© 2024–2026 Dave Nuñez. All rights reserved.",
		);
		expect(doc.querySelector("p span")?.className).toBe("whitespace-nowrap");
	});
});

describe("PageTitle", () => {
	it("renders a bare h1 without a label", async () => {
		const doc = parse(
			await render(PageTitle, { slots: { default: "Writing" } }),
		);
		expect(doc.querySelector("hgroup")).toBeNull();
		expect(doc.querySelector("h1")?.textContent).toBe("Writing");
	});

	it("groups a label above the h1", async () => {
		const doc = parse(
			await render(PageTitle, {
				props: { label: "Topic" },
				slots: { default: "#systems" },
			}),
		);
		const [label, title] = doc.querySelector("hgroup")?.children ?? [];
		expect(label?.localName).toBe("p");
		expect(label?.textContent).toBe("Topic");
		expect(title?.localName).toBe("h1");
		expect(title?.textContent).toBe("#systems");
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

	it("labels the direction links Newer and Older and hides their glyphs", async () => {
		const doc = parse(
			await render(Pagination, { props: { current: 5, total: 12, href } }),
		);
		const prev = doc.querySelector('a[rel="prev"]');
		const next = doc.querySelector('a[rel="next"]');
		expect(prev?.textContent?.trim()).toBe("< Newer");
		expect(prev?.querySelector('[aria-hidden="true"]')?.textContent).toBe("<");
		expect(next?.textContent?.trim()).toBe("Older >");
		expect(next?.querySelector('[aria-hidden="true"]')?.textContent).toBe(">");
	});

	it("keeps the markup in visual order, with a status for narrow screens", async () => {
		const doc = parse(
			await render(Pagination, { props: { current: 5, total: 12, href } }),
		);
		const order = [
			...doc.querySelectorAll('a[rel="prev"], ol, p, a[rel="next"]'),
		].map((element) => element.getAttribute("rel") ?? element.localName);
		expect(order).toEqual(["prev", "ol", "p", "next"]);
		expect(doc.querySelector("nav p")?.textContent?.trim()).toBe(
			"Page 5 of 12",
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

describe("WritingList", () => {
	const article = {
		title: "First",
		href: "/writing/first/",
		date: new Date("2026-01-02"),
	};

	it("hides Pagination on a single page", async () => {
		const doc = parse(
			await render(WritingList, {
				props: { articles: [article], current: 1, total: 1 },
			}),
		);
		expect(doc.querySelector("ol")).not.toBeNull();
		expect(doc.querySelector("nav")).toBeNull();
	});

	it("shows Pagination, right after the list, once there is more than one page", async () => {
		const doc = parse(
			await render(WritingList, {
				props: { articles: [article], current: 1, total: 2 },
			}),
		);
		const [list, nav] = [...doc.body.children];
		expect(list?.localName).toBe("ol");
		expect(nav?.localName).toBe("nav");
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
		const frame = doc.querySelector("[data-codeblock]");
		expect(frame?.querySelector("[data-codeblock-file]")?.textContent).toBe(
			"answer.ts",
		);
		expect(frame?.querySelector("[data-codeblock-lang]")?.textContent).toBe(
			"ts",
		);
		const html = frame?.querySelector("pre")?.outerHTML ?? "";
		expect(html).toContain("var(--color-syntax-keyword)");
		expect(html).toContain("font-weight:600");
		expect(html).not.toContain("font-weight:bold");
	});

	it("names the scrollable code for assistive technology", async () => {
		const doc = parse(
			await render(CodeBlock, {
				props: { code: "pnpm build", lang: "sh", file: "build.sh" },
			}),
		);
		const pre = doc.querySelector("pre");
		expect(pre?.getAttribute("role")).toBe("group");
		expect(pre?.getAttribute("aria-label")).toBe("Code: build.sh, sh");
	});

	it("wraps a Windows-style path at each backslash", async () => {
		// The component's `file` prop round-trips through fenceMeta/parseFenceMeta
		// only, not Markdown's own info-string unescaping, so backslashes survive.
		const doc = parse(
			await render(CodeBlock, {
				props: { code: "x", lang: "ts", file: "C:\\Users\\dave\\app.ts" },
			}),
		);
		const file = doc.querySelector("[data-codeblock-file]");
		expect(file?.innerHTML).toBe("C:\\<wbr>Users\\<wbr>dave\\<wbr>app.ts");
		expect(file?.textContent).toBe("C:\\Users\\dave\\app.ts");
	});

	it("puts a caption below the code and only when given one, framed as a figure", async () => {
		const withCaption = parse(
			await render(CodeBlock, {
				props: { code: "x", lang: "ts", caption: 'Say "hi".' },
			}),
		);
		expect(
			withCaption.querySelector("figure[data-codeblock] > figcaption")
				?.textContent,
		).toBe('Say "hi".');
		const without = parse(
			await render(CodeBlock, { props: { code: "x", lang: "ts" } }),
		);
		expect(without.querySelector("figcaption")).toBeNull();
		expect(without.querySelector("[data-codeblock-file]")).toBeNull();
	});

	it("frames a block without a caption as a div, so screen readers don't announce an empty figure", async () => {
		const doc = parse(
			await render(CodeBlock, { props: { code: "x", lang: "ts" } }),
		);
		expect(doc.querySelector("figure[data-codeblock]")).toBeNull();
		expect(doc.querySelector("div[data-codeblock]")).not.toBeNull();
	});

	it("hides the header from assistive technology", async () => {
		const doc = parse(
			await render(CodeBlock, {
				props: { code: "x", lang: "ts", file: "x.ts" },
			}),
		);
		expect(
			doc.querySelector("[data-codeblock-header]")?.getAttribute("aria-hidden"),
		).toBe("true");
	});
});

describe("MermaidDiagram", { timeout: 60_000 }, () => {
	it("renders its code at build into the same figure as Markdown fences", async () => {
		const doc = parse(
			await render(MermaidDiagram, {
				props: { code: "flowchart LR\n  accTitle: Two steps\n  A --> B" },
			}),
		);
		const figure = doc.querySelector("figure[data-diagram]");
		expect(figure?.getAttribute("aria-label")).toBe("Two steps");
		expect(figure?.querySelector("svg")).not.toBeNull();
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

describe("Container", () => {
	it("renders a div by default and merges the caller's class", async () => {
		const doc = parse(
			await render(Container, {
				props: { class: "f6y-py-2" },
				slots: { default: "Content" },
			}),
		);
		const el = doc.querySelector("div");
		expect(el?.classList.contains("max-w-site")).toBe(true);
		expect(el?.classList.contains("f6y-py-2")).toBe(true);
		expect(el?.textContent).toBe("Content");
	});

	it("renders the tag given by the as prop instead of a div", async () => {
		const doc = parse(
			await render(Container, {
				props: { as: "section" },
				slots: { default: "Content" },
			}),
		);
		expect(doc.querySelector("section")).not.toBeNull();
		expect(doc.querySelector("div.max-w-site")).toBeNull();
	});
});

describe("Prose", () => {
	it("renders a div with the prose class by default", async () => {
		const doc = parse(await render(Prose, { slots: { default: "Text" } }));
		const el = doc.querySelector("div");
		expect(el?.classList.contains("prose")).toBe(true);
	});

	it("renders the tag given by the as prop and keeps the prose class", async () => {
		const doc = parse(
			await render(Prose, {
				props: { as: "article", class: "f6y-mb-8" },
				slots: { default: "Text" },
			}),
		);
		const el = doc.querySelector("article");
		expect(el?.classList.contains("prose")).toBe(true);
		expect(el?.classList.contains("f6y-mb-8")).toBe(true);
	});
});

describe("SkipLink", () => {
	it("links to #main by default", async () => {
		const doc = parse(await render(SkipLink));
		expect(doc.querySelector("a")?.getAttribute("href")).toBe("#main");
	});

	it("links to the given target", async () => {
		const doc = parse(await render(SkipLink, { props: { target: "content" } }));
		expect(doc.querySelector("a")?.getAttribute("href")).toBe("#content");
	});
});

describe("WordMark", () => {
	it("links to / by default and omits the tagline when absent", async () => {
		const doc = parse(
			await render(WordMark, { props: { name: "Dave Nuñez" } }),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/");
		expect(link?.textContent?.trim()).toBe("Dave Nuñez");
		expect(doc.querySelectorAll("span")).toHaveLength(1);
	});

	it("renders the tagline and a custom href when given", async () => {
		const doc = parse(
			await render(WordMark, {
				props: {
					name: "Dave Nuñez",
					tagline: "Software leader",
					href: "/about",
				},
			}),
		);
		const link = doc.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/about");
		expect(doc.querySelectorAll("span")).toHaveLength(2);
		expect(link?.textContent).toContain("Software leader");
	});

	it("hides the tagline from assistive technology, so the link's name is just the name", async () => {
		const doc = parse(
			await render(WordMark, {
				props: { name: "Dave Nuñez", tagline: "Leader / Builder / Integrator" },
			}),
		);
		const tagline = doc.querySelectorAll("span")[1];
		expect(tagline?.getAttribute("aria-hidden")).toBe("true");
	});

	it("shows the tagline only from the measure breakpoint up", async () => {
		const doc = parse(
			await render(WordMark, {
				props: { name: "Dave Nuñez", tagline: "Leader / Builder / Integrator" },
			}),
		);
		const tagline = doc.querySelectorAll("span")[1]?.classList;
		expect(tagline).toContain("hidden");
		expect(tagline).toContain("measure:block");
	});
});

describe("TopicList", () => {
	const topics = [
		{ name: "design" },
		{ name: "markdown", href: "/topics/markdown" },
	];

	it("renders one Topic per item under the default label", async () => {
		const doc = parse(await render(TopicList, { props: { topics } }));
		const list = doc.querySelector("ul");
		expect(list?.getAttribute("aria-label")).toBe("Topics");
		expect(list?.querySelectorAll("li")).toHaveLength(2);
		expect(list?.querySelector("a")?.getAttribute("href")).toBe(
			"/topics/markdown",
		);
	});

	it("uses the index layout's balanced spacing and takes no aria-label: the page's h1 names it", async () => {
		const doc = parse(
			await render(TopicList, {
				props: { topics, index: true },
			}),
		);
		const list = doc.querySelector("ul");
		expect(list?.hasAttribute("aria-label")).toBe(false);
		expect(list?.classList.contains("text-balance")).toBe(true);
		expect(list?.querySelector("li")?.classList.contains("inline-block")).toBe(
			true,
		);
	});

	it("honors a custom label outside index mode", async () => {
		const doc = parse(
			await render(TopicList, { props: { topics, label: "All topics" } }),
		);
		expect(doc.querySelector("ul")?.getAttribute("aria-label")).toBe(
			"All topics",
		);
	});

	it("forbids label together with index at the type level", () => {
		// index and label are mutually exclusive (TopicList.astro): index mode
		// never renders an aria-label, so a caller can't pass label alongside
		// it. astro check enforces this on every real <TopicList index label=…>
		// usage; this pins the same guarantee at the Props type itself.
		// @ts-expect-error label isn't assignable together with index: true
		const invalid: ComponentProps<typeof TopicList> = {
			topics: [],
			index: true,
			label: "All topics",
		};
		expect(invalid).toBeDefined();
	});
});

describe("Portrait", () => {
	it("renders an accessible placeholder when there is no src", async () => {
		const doc = parse(await render(Portrait, { props: { alt: "Dave Nuñez" } }));
		const placeholder = doc.querySelector('[role="img"]');
		expect(placeholder?.getAttribute("aria-label")).toBe("Dave Nuñez");
		expect(placeholder?.classList.contains("bg-media-ground")).toBe(true);
		expect(doc.querySelector("img")).toBeNull();
	});

	it("floats right and adds the circle shape when float is set", async () => {
		const doc = parse(
			await render(Portrait, { props: { alt: "Dave Nuñez", float: true } }),
		);
		const figure = doc.querySelector("figure");
		expect(figure?.classList.contains("float-right")).toBe(true);
		expect(figure?.classList.contains("shape-circle")).toBe(true);
	});
});

describe("Figure", () => {
	it("renders a caption when given one and omits figcaption otherwise", async () => {
		const withCaption = parse(
			await render(Figure, {
				props: { caption: "A diagram." },
				slots: { default: '<img src="/a.jpg" alt="" />' },
			}),
		);
		expect(withCaption.querySelector("figcaption")?.textContent).toBe(
			"A diagram.",
		);

		const withoutCaption = parse(
			await render(Figure, {
				slots: { default: '<img src="/a.jpg" alt="" />' },
			}),
		);
		expect(withoutCaption.querySelector("figcaption")).toBeNull();
	});

	it("bleeds into the gutter and pads the caption when wide is set", async () => {
		const doc = parse(
			await render(Figure, {
				props: { caption: "Wide.", wide: true },
				slots: { default: '<img src="/a.jpg" alt="" />' },
			}),
		);
		expect(doc.querySelector("figure")?.classList.contains("bleed-x-4")).toBe(
			true,
		);
		expect(
			doc.querySelector("figcaption")?.classList.contains("f6y-px-4"),
		).toBe(true);
	});
});
