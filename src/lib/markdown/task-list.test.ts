import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { taskListState } from "./task-list";

const render = (markdown: string) =>
	markdownToHtml(markdown, { hastPlugins: [taskListState()] }).html;

describe("taskListState", () => {
	it("hides an unchecked checkbox and prefixes its text with a hidden 'To do: '", () => {
		expect(render("- [ ] Write the draft\n")).toBe(
			'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" disabled aria-hidden="true">' +
				'<span class="sr-only">To do: </span> Write the draft</li>\n' +
				"</ul>\n",
		);
	});

	it("hides a checked checkbox and prefixes its text with a hidden 'Done: '", () => {
		expect(render("- [x] Write the draft\n")).toBe(
			'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" checked disabled aria-hidden="true">' +
				'<span class="sr-only">Done: </span> Write the draft</li>\n' +
				"</ul>\n",
		);
	});

	it("prefixes a nested task item independently of its parent", () => {
		expect(render("- [ ] Parent task\n  - [x] Nested child\n")).toBe(
			'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" disabled aria-hidden="true">' +
				'<span class="sr-only">To do: </span> Parent task\n' +
				'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" checked disabled aria-hidden="true">' +
				'<span class="sr-only">Done: </span> Nested child</li>\n' +
				"</ul>\n</li>\n</ul>\n",
		);
	});

	it("keeps a link and inline code in the item text, after the hidden prefix", () => {
		expect(
			render(
				"- [ ] Read the [style guide](/writing/markdown-style-guide/) and run `pnpm test`\n",
			),
		).toBe(
			'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" disabled aria-hidden="true">' +
				'<span class="sr-only">To do: </span> Read the ' +
				'<a href="/writing/markdown-style-guide/">style guide</a> and run <code>pnpm test</code></li>\n' +
				"</ul>\n",
		);
	});

	it("leaves a plain list item alone", () => {
		expect(render("- Not a task\n")).toBe("<ul>\n<li>Not a task</li>\n</ul>\n");
	});

	it("hoists a loose item's checkbox out of its <p>, prefix first inside it", () => {
		// A blank line between items makes the list loose: GFM wraps each item's
		// content in a <p>, checkbox included, so `li.task-list-item > input`
		// (prose.css) doesn't match unless the checkbox is moved back out.
		expect(render("- [ ] Loose todo one\n\n- [x] Loose done two\n")).toBe(
			'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" disabled aria-hidden="true">\n' +
				'<p><span class="sr-only">To do: </span> Loose todo one</p>\n' +
				"</li>\n" +
				'<li class="task-list-item"><input type="checkbox" checked disabled aria-hidden="true">\n' +
				'<p><span class="sr-only">Done: </span> Loose done two</p>\n' +
				"</li>\n</ul>\n",
		);
	});

	it("prefixes only the first paragraph of a loose, multi-paragraph item", () => {
		expect(
			render(
				"- [ ] First paragraph of a loose item\n\n  Second paragraph of the same item.\n",
			),
		).toBe(
			'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" disabled aria-hidden="true">\n' +
				'<p><span class="sr-only">To do: </span> First paragraph of a loose item</p>\n' +
				"<p>Second paragraph of the same item.</p>\n</li>\n</ul>\n",
		);
	});

	it("hoists checkboxes in a nested loose list independently of its loose parent", () => {
		expect(
			render(
				"- [ ] Parent task\n\n  - [ ] Nested todo one\n\n  - [x] Nested done two\n",
			),
		).toBe(
			'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" disabled aria-hidden="true">\n' +
				'<p><span class="sr-only">To do: </span> Parent task</p>\n' +
				'<ul class="contains-task-list">\n' +
				'<li class="task-list-item"><input type="checkbox" disabled aria-hidden="true">\n' +
				'<p><span class="sr-only">To do: </span> Nested todo one</p>\n' +
				"</li>\n" +
				'<li class="task-list-item"><input type="checkbox" checked disabled aria-hidden="true">\n' +
				'<p><span class="sr-only">Done: </span> Nested done two</p>\n' +
				"</li>\n</ul>\n</li>\n</ul>\n",
		);
	});
});
