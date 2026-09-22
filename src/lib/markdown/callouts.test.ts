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
});
