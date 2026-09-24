import {
	satteriCreateHighlightFn,
	satteriHighlightPlugin,
} from "@astrojs/markdown-satteri";
import { Window } from "happy-dom";
import { markdownToHtml } from "satteri";
import { beforeAll, describe, expect, it } from "vitest";
import {
	fenceMeta,
	parseFenceMeta,
	syntaxTheme,
	syntaxTransformers,
} from "./syntax";

describe("parseFenceMeta", () => {
	it("reads quoted key-value pairs and skips bare words", () => {
		expect(
			parseFenceMeta(
				'title="src/app.ts" showLineNumbers caption="Entry point."',
			),
		).toEqual({
			title: "src/app.ts",
			caption: "Entry point.",
		});
	});

	it("round-trips quotes and backslashes through fenceMeta", () => {
		const attributes = { title: 'say "hi".ts', caption: "C:\\path" };
		expect(parseFenceMeta(fenceMeta(attributes))).toEqual(attributes);
	});

	it("leaves out undefined values", () => {
		expect(fenceMeta({ title: undefined, caption: "Only this." })).toBe(
			'caption="Only this."',
		);
	});
});

/** Markdown the way Astro renders it: Sätteri with Astro's Shiki highlight plugin. */
describe("code fences in Markdown", () => {
	let render: (markdown: string) => Promise<Document>;
	beforeAll(async () => {
		const highlight = await satteriCreateHighlightFn("shiki", {
			theme: syntaxTheme,
			transformers: syntaxTransformers,
		});
		if (highlight === undefined) throw new Error("Shiki highlighting is off.");
		const { DOMParser } = new Window();
		render = async (markdown) => {
			const { html } = await markdownToHtml(markdown, {
				hastPlugins: [satteriHighlightPlugin(highlight, [])],
			});
			return new DOMParser().parseFromString(
				html,
				"text/html",
			) as unknown as Document;
		};
	});

	it("frames the block with the fence's language and title", async () => {
		const doc = await render(
			'```ts title="src/lib/writing.ts"\nconst a = 1;\n```\n',
		);
		const frame = doc.querySelector("[data-codeblock]");
		expect(frame?.querySelector("[data-codeblock-file]")?.textContent).toBe(
			"src/lib/writing.ts",
		);
		expect(frame?.querySelector("[data-codeblock-lang]")?.textContent).toBe(
			"ts",
		);
		const pre = frame?.querySelector("pre");
		expect(pre?.getAttribute("data-language")).toBe("ts");
		expect(pre?.getAttribute("role")).toBe("group");
		expect(pre?.getAttribute("aria-label")).toBe(
			"Code: src/lib/writing.ts, ts",
		);
		expect(pre?.getAttribute("tabindex")).toBe("0");
	});

	it("names a fence without a language plain text and shows no file", async () => {
		const doc = await render("```\nplain words\n```\n");
		expect(doc.querySelector("[data-codeblock-file]")).toBeNull();
		expect(doc.querySelector("[data-codeblock-lang]")?.textContent).toBe(
			"text",
		);
		expect(doc.querySelector("pre")?.getAttribute("aria-label")).toBe(
			"Code: text",
		);
	});

	it("hides the header from assistive technology: the pre's own label already names it", async () => {
		const doc = await render(
			'```ts title="src/lib/writing.ts"\nconst a = 1;\n```\n',
		);
		expect(
			doc.querySelector("[data-codeblock-header]")?.getAttribute("aria-hidden"),
		).toBe("true");
	});

	it("frames a block without a caption as a div, not a figure", async () => {
		const doc = await render(
			'```ts title="src/lib/writing.ts"\nconst a = 1;\n```\n',
		);
		expect(doc.querySelector("figure[data-codeblock]")).toBeNull();
		expect(doc.querySelector("div[data-codeblock]")).not.toBeNull();
	});

	it("adds a caption below the code when the fence has one, and keeps the figure", async () => {
		const doc = await render(
			'```sh caption="Run it from the repo root."\npnpm build\n```\n',
		);
		expect(doc.querySelector("div[data-codeblock]")).toBeNull();
		const caption = doc.querySelector("figure[data-codeblock] > figcaption");
		expect(caption?.textContent).toBe("Run it from the repo root.");
		expect(caption?.previousElementSibling?.tagName).toBe("PRE");
	});

	it("sets keywords at 600, not Shiki's bold", async () => {
		const doc = await render("```ts\nexport const a = 1;\n```\n");
		const html = doc.querySelector("pre")?.outerHTML ?? "";
		expect(html).toContain("font-weight:600");
		expect(html).not.toContain("font-weight:bold");
	});
});
