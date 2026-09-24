import { describe, expect, it } from "vitest";
import {
	type ArticleFitOptions,
	balance,
	clamp,
	fitArticle,
	wrap,
} from "./layout";

/** One unit per character: widths read as character counts. */
const chars = (text: string) => text.length;
const words = (count: number) =>
	Array.from({ length: count }, () => "word").join(" ");

describe("wrap", () => {
	it("fills each line with words until the next would overflow", () => {
		expect(wrap("aaaa bbbb cccc dddd eeee", chars, 20)).toEqual([
			"aaaa bbbb cccc dddd",
			"eeee",
		]);
	});

	it("keeps a word wider than the line on a line of its own", () => {
		expect(wrap("internationalization is long", chars, 10)).toEqual([
			"internationalization",
			"is long",
		]);
	});
});

describe("balance", () => {
	it("keeps the line count and evens out the lines", () => {
		expect(balance("aaaa bbbb cccc dddd eeee", chars, 20)).toEqual([
			"aaaa bbbb cccc",
			"dddd eeee",
		]);
	});

	it("leaves a line that fits alone", () => {
		expect(balance("On restraint", chars, 20)).toEqual(["On restraint"]);
	});
});

describe("clamp", () => {
	it("ends a cut at a whole word, with an ellipsis that fits", () => {
		expect(clamp(["one two three", "four five six"], 1, chars, 15)).toEqual([
			"one two three…",
		]);
	});

	it("drops punctuation before the ellipsis", () => {
		expect(clamp(["one, two,", "three"], 1, chars, 10)).toEqual(["one, two…"]);
	});

	it("keeps lines that already fit", () => {
		expect(clamp(["one", "two"], 2, chars, 10)).toEqual(["one", "two"]);
	});
});

describe("fitArticle", () => {
	// Characters are half the size wide: 20 per line at size 10, 25 at 8, 40 at 5.
	const options: ArticleFitOptions = {
		sizes: [10, 8, 5],
		measureTitle: (size) => (text) => (text.length * size) / 2,
		measureSubtitle: chars,
		maxWidth: 100,
		firstBaseline: (size) => 10 + size,
		floor: 35,
		titleLeading: 1,
		subtitle: { gap: 10, lineHeight: 10, maxLines: 2 },
	};

	it("keeps a short title at the largest size", () => {
		expect(fitArticle("On restraint", undefined, options)).toEqual({
			size: 10,
			lines: ["On restraint"],
			subtitleLines: [],
		});
	});

	it("steps the title down before shortening the subtitle", () => {
		const fit = fitArticle(words(6), "A short subtitle", options);
		expect(fit.size).toBe(5);
		expect(fit.subtitleLines).toEqual(["A short subtitle"]);
	});

	it("drops the subtitle to one line before cutting the title", () => {
		const fit = fitArticle(words(12), words(30), options);
		expect(fit.size).toBe(5);
		expect(fit.lines).toHaveLength(2);
		expect(fit.lines.join(" ")).toBe(words(12));
		expect(fit.subtitleLines).toHaveLength(1);
		expect(fit.subtitleLines[0]).toMatch(/word…$/);
	});

	it("cuts the title at a word only when nothing else fits", () => {
		const fit = fitArticle(words(40), words(30), options);
		expect(fit.size).toBe(5);
		expect(fit.lines).toHaveLength(3);
		expect(fit.lines.at(-1)).toMatch(/word…$/);
	});
});
