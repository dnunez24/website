import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { tableScroll } from "./table-scroll";

const render = (markdown: string) =>
	markdownToHtml(markdown, { hastPlugins: [tableScroll()] }).html;

// GFM pipe-table syntax has no caption syntax, and this pipeline leaves raw
// HTML in `.md` as an opaque, unparsed node (`features.rawHtml` is off in
// `astro.config.ts`), so no page this site builds today can give a table a
// `<caption>`. These two cases turn `rawHtml` on to reach the caption branch
// directly and prove it still wins over the header-cell name when a
// `<caption>` does reach the wrapper by some other route (MDX JSX, or this
// pipeline's `rawHtml` turned on) — not a claim that GFM or today's `.md`
// content can produce one.
const renderRawHtmlCaption = (markdown: string) =>
	markdownToHtml(markdown, {
		hastPlugins: [tableScroll()],
		features: { rawHtml: true },
	}).html;

describe("tableScroll", () => {
	it("names a captionless table after its first three header cells", () => {
		expect(
			render(
				"| Token | Use | Milliseconds |\n| --- | --- | --- |\n| a | b | c |\n",
			),
		).toBe(
			'<div data-table-scroll="" tabindex="0" role="group" aria-label="Table: Token, Use, Milliseconds">' +
				"<table>\n" +
				"<thead>\n<tr>\n<th>Token</th>\n<th>Use</th>\n<th>Milliseconds</th>\n</tr>\n</thead>\n" +
				"<tbody>\n<tr>\n<td>a</td>\n<td>b</td>\n<td>c</td>\n</tr>\n</tbody>\n" +
				"</table></div>\n",
		);
	});

	it("takes only the first three header cells, adding nothing for the rest", () => {
		const html = render(
			"| Option | Type | Default | Env | Notes |\n| --- | --- | --- | --- | --- |\n| a | b | c | d | e |\n",
		);
		expect(html.match(/aria-label="([^"]*)"/)?.[1]).toBe(
			"Table: Option, Type, Default",
		);
	});

	it("skips an empty header cell rather than counting it toward the first three", () => {
		// A corner cell before a row-label column is often left blank
		// (`|   | A | B | C |`). Filtering empty cells before slicing to three
		// means the name still reaches three *named* columns instead of
		// stopping at "Table: A, B".
		const html = render(
			"|   | A | B | C |\n| - | - | - | - |\n| x | 1 | 2 | 3 |\n",
		);
		expect(html.match(/aria-label="([^"]*)"/)?.[1]).toBe("Table: A, B, C");
	});

	it("names the region after the table's caption alone when one reaches it", () => {
		const html = renderRawHtmlCaption(
			"<table>\n<caption>Release history</caption>\n" +
				"<thead><tr><th>Version</th></tr></thead>\n" +
				"<tbody><tr><td>1.0</td></tr></tbody>\n</table>\n",
		);
		expect(html).toBe(
			'<div data-table-scroll="" tabindex="0" role="group" aria-label="Release history">' +
				"<table>\n<caption>Release history</caption>\n" +
				"<thead><tr><th>Version</th></tr></thead>\n" +
				"<tbody><tr><td>1.0</td></tr></tbody>\n</table></div>\n",
		);
	});

	it("prefers the caption over the header cells when a table has both", () => {
		const html = renderRawHtmlCaption(
			"<table>\n<caption>Release history</caption>\n" +
				"<thead><tr><th>Version</th><th>Date</th></tr></thead>\n" +
				"<tbody><tr><td>1.0</td><td>2024</td></tr></tbody>\n</table>\n",
		);
		expect(html.match(/aria-label="([^"]*)"/)?.[1]).toBe("Release history");
	});

	it("numbers repeated labels on one page, first occurrence unchanged", () => {
		const html = render(
			"| Key | Value |\n| --- | --- |\n| a | b |\n\n" +
				"| Key | Value |\n| --- | --- |\n| c | d |\n\n" +
				"| Key | Value |\n| --- | --- |\n| e | f |\n",
		);
		const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
		expect(labels).toEqual([
			"Table: Key, Value",
			"Table: Key, Value (2)",
			"Table: Key, Value (3)",
		]);
	});

	it("doesn't number tables with different labels", () => {
		const html = render(
			"| Key | Value |\n| --- | --- |\n| a | b |\n\n" +
				"| Token | Use |\n| --- | --- |\n| c | d |\n",
		);
		const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
		expect(labels).toEqual(["Table: Key, Value", "Table: Token, Use"]);
	});

	it("resets the count for a new document, since this plugin is created once and reused", () => {
		const shared = tableScroll();
		const table = "| Key | Value |\n| --- | --- |\n| a | b |\n";
		const doc1 = markdownToHtml(table, { hastPlugins: [shared] }).html;
		const doc2 = markdownToHtml(table, { hastPlugins: [shared] }).html;
		expect(doc1).toContain('aria-label="Table: Key, Value"');
		expect(doc2).toContain('aria-label="Table: Key, Value"');
		expect(doc2).not.toContain("(2)");
	});
});
