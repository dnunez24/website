import { Window } from "happy-dom";
import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { callouts } from "./callouts";

const { DOMParser } = new Window();
const render = async (markdown: string) =>
	new DOMParser().parseFromString(
		(await markdownToHtml(markdown, { hastPlugins: callouts() })).html,
		"text/html",
	) as unknown as Document;

const titleParts = (doc: Document) =>
	[...(doc.querySelector(".callout-title")?.children ?? [])].map(
		(part) => `${part.className}:${part.textContent}`,
	);

describe("callouts", () => {
	it("titles a callout with its type name", async () => {
		const doc = await render(
			"> [!NOTE]\n> Checkout ran on its own from 2017.\n",
		);
		expect(doc.querySelector(".callout")?.getAttribute("data-callout")).toBe(
			"note",
		);
		expect(titleParts(doc)).toEqual(["callout-type:Note"]);
		expect(doc.querySelector(".callout-content p")?.textContent).toBe(
			"Checkout ran on its own from 2017.",
		);
	});

	it("keeps the type name before a custom title, with a hidden colon", async () => {
		const doc = await render(
			"> [!WARNING] Before you _migrate_\n> Back up first.\n",
		);
		expect(titleParts(doc)).toEqual([
			"callout-type:Warning",
			"sr-only:: ",
			"callout-title-text:Before you migrate",
		]);
		expect(doc.querySelector(".callout-title-text em")?.textContent).toBe(
			"migrate",
		);
	});

	it("makes a collapsible callout a details element with an empty, hidden marker", async () => {
		const closed = await render(
			"> [!TIP]- Where to start\n> The slowest part.\n",
		);
		const details = closed.querySelector("details.callout");
		expect(details?.hasAttribute("open")).toBe(false);
		// <summary> takes phrasing content only.
		expect(details?.querySelector("summary div")).toBeNull();
		const marker = details?.querySelector("summary .callout-fold-icon");
		expect(marker?.getAttribute("aria-hidden")).toBe("true");
		expect(marker?.innerHTML).toBe("");

		const open = await render(
			"> [!TIP]+ Where to start\n> The slowest part.\n",
		);
		expect(open.querySelector("details.callout")?.hasAttribute("open")).toBe(
			true,
		);
	});

	it("fails on a collapsible callout without a title", async () => {
		await expect(
			render("> [!NOTE]-\n> Hidden until opened.\n"),
		).rejects.toThrow(/Give this collapsible note callout a title/);
	});

	it("leaves an unknown type as a quote", async () => {
		const doc = await render("> [!unknown]\n> Stays a quote.\n");
		expect(doc.querySelector(".callout")).toBeNull();
		expect(doc.querySelector("blockquote")).not.toBeNull();
	});

	it("labels a non-folding callout as a group, pointed at its titled id", async () => {
		const doc = await render(
			"> [!NOTE]\n> Checkout ran on its own from 2017.\n",
		);
		const callout = doc.querySelector(".callout");
		expect(callout?.tagName).toBe("DIV");
		expect(callout?.getAttribute("role")).toBe("group");
		const title = doc.querySelector(".callout-title");
		expect(title?.id).toBe("dn-callout-1");
		expect(callout?.getAttribute("aria-labelledby")).toBe(title?.id);
	});

	it("numbers every non-folding callout on the page in order", async () => {
		const doc = await render(
			"> [!NOTE]\n> One.\n\n> [!TIP]\n> Two.\n\n> [!WARNING]\n> Three.\n",
		);
		expect(
			[...doc.querySelectorAll(".callout-title")].map((t) => t.id),
		).toEqual(["dn-callout-1", "dn-callout-2", "dn-callout-3"]);
	});

	it("leaves a folding callout without a group role or a title id", async () => {
		const doc = await render("> [!TIP]- Where to start\n> The slowest part.\n");
		const details = doc.querySelector("details.callout");
		expect(details?.hasAttribute("role")).toBe(false);
		expect(details?.hasAttribute("aria-labelledby")).toBe(false);
		expect(details?.querySelector(".callout-title")?.hasAttribute("id")).toBe(
			false,
		);
	});

	it("does not consume a number when a folding callout sits between two others", async () => {
		const doc = await render(
			"> [!NOTE]\n> One.\n\n> [!TIP]- Where to start\n> Skipped.\n\n> [!WARNING]\n> Two.\n",
		);
		expect(
			[...doc.querySelectorAll("div.callout .callout-title")].map((t) => t.id),
		).toEqual(["dn-callout-1", "dn-callout-2"]);
	});

	it("resets the id counter per document, not per build", async () => {
		// astro.config.ts calls callouts() once and reuses the plugin list for
		// every file a build processes, so the counter has to live in a factory
		// satteri re-invokes per document, not in callouts()'s own closure.
		const plugins = callouts();
		const renderWith = async (markdown: string) =>
			new DOMParser().parseFromString(
				(await markdownToHtml(markdown, { hastPlugins: plugins })).html,
				"text/html",
			) as unknown as Document;

		const first = await renderWith("> [!NOTE]\n> One.\n\n> [!TIP]\n> Two.\n");
		expect(
			[...first.querySelectorAll(".callout-title")].map((t) => t.id),
		).toEqual(["dn-callout-1", "dn-callout-2"]);

		const second = await renderWith("> [!WARNING]\n> Fresh document.\n");
		expect(second.querySelector(".callout-title")?.id).toBe("dn-callout-1");
	});
});
