# Tasks

## 1. Dependency

- [x] 1.1 Add `"pele": "1.13.0"` (exact, no caret) to `dependencies` with `pnpm add pele@1.13.0 --save-exact`. Verify that `pnpm-lock.yaml` resolves `pele@1.13.0` and that `node -e 'require("pele")'` loads.

## 2. Renderer (`src/lib/mermaid.ts`)

- [x] 2.1 Replace the `mermaid-isomorphic` call with a synchronous `render()` that uses the D1 options and the D2 fixed-advance measurer. Delete `mermaidConfig`, `fonts()`, the `renderer` and `fontStylesheet` singletons, and the Chromium install hint. Make `renderMermaidFigure(source): string` synchronous. Verify that `pnpm check` passes, with no type errors at the three callers.
- [x] 2.2 Build the `aria-label` from the id-matched `<title>`/`<desc>` (D3), decoding entities before `escapeAttribute`. Keep the "accTitle or accDescr" error, and add the two-line example from D3 before the diagram source. Verify with `src/lib/mermaid.test.ts` cases: title + desc, title only, a journey with `title My journey` + `accDescr` labelled `A journey diagram.`, an `accTitle` with `"<>&` whose parsed `aria-label` equals the source text, and an unnamed diagram whose error matches `/accTitle or accDescr/`, contains `accTitle: ` and `accDescr: ` example lines, and ends with the source.
- [x] 2.3 Map `PeleError` to `Mermaid couldn't render this diagram: {error.message}\n\n{source}` with `{ cause }`, and let other errors propagate (D5). Verify with tests: a dangling `A -->` on line 3 gives a message matching `/couldn't render/` that contains `line 3`, `  A -->` and a `^` marker line, and ends with the source. `accDescription: Hi` on line 3 gives `line 3` and that line. A frontmatter diagram failing on its fifth line gives `line 5`. An unknown diagram type gives `/couldn't render/` and "No diagram type detected".
- [x] 2.4 Make the link guard `result.links.length > 0 || /<a[\s/>]/` and drop `RENDERED_SVG_CLICKABLE` (D4). Rewrite its comment for Pele. Verify that `click … href` still throws `/can't carry its own link/`. Turn the callback-click and sequence-`link` tests into "renders a figure with no `<a>`". Keep the three "prose starting with click" tests passing.
- [x] 2.5 Shrink `atRenderedSize` to adding `aria-hidden="true"` (Pele already emits pixel `width`/`height` with `responsive: false`), or inline it. Verify with the "named, focusable figure at the diagram's rendered size" test, which checks numeric width/height, no `max-width` and `aria-hidden`.
- [x] 2.6 Replace the "different ids" test, which reads `svg.id` (Pele's root has none). The new test asserts that two sources share no `id` value and that each `aria-labelledby` resolves to its own `<title>`. Add an assertion that the same source renders byte-identical output. Add a measurer test: a `flowchart LR` with nodes `iiii` and `WWWW` gives equal node `<rect>` widths. Verify that `pnpm vitest run src/lib/mermaid.test.ts` passes.
- [x] 2.7 Drop the `{ timeout: 60_000 }` and "headless Chromium" comments from `mermaid.test.ts`, `components.test.ts` (`MermaidDiagram` describe) and `no-js.test.ts`. Change their `await renderMermaidFigure` calls to sync. Verify that those three files pass with the default timeout.
- [x] 2.8 In `no-js.test.ts`, the regression case for the happy-dom SVG `<style>` bug no longer gets a `<style>` from a real figure (Pele emits none). Build that case from a literal `<svg><style>…</style></svg>` fixture, and keep the real-figure "passes on its own" case. Verify that the regression test fails when the scanner is pointed at a happy-dom parse that drops content after `<style>` (spot-check locally), and that it passes as committed.

## 3. Markdown plugin and dev-page cleanup

- [x] 3.1 Make `mermaidDiagrams()` take no arguments and render every `mermaid` fence. Remove the `dropsDevPages`/`isDevPageFile` skip and its doc paragraph (D7). Update `astro.config.ts` to `mermaidDiagrams()`, and delete `projectRoot` with its comment. Verify that `pnpm check` passes.
- [x] 3.2 Rewrite `src/lib/markdown/mermaid.test.ts`. Drop the `vi.mock` of the renderer and the PROD/dev-page cases. Assert that a fence in a `src/pages/dev/` file renders a figure with `PROD` stubbed true, and that an unnamed fence's error starts with the file path. Verify with `pnpm vitest run src/lib/markdown/mermaid.test.ts`.
- [x] 3.3 Delete `isDevPageFile`, `isDevPagePath` and `PAGES_DIR` from `src/lib/routes.ts`, and their `describe` blocks from `routes.test.ts`. Remove the Mermaid-plugin sentence from the `dropsDevPages` doc. Verify that a search for `isDevPageFile|isDevPagePath` returns nothing and that `pnpm vitest run src/lib/routes.test.ts` passes.
- [x] 3.4 Update the comments that name Chromium or the old renderer: `MermaidDiagram.astro`, the `astro.config.ts` `syntaxHighlight` comment if needed, and the header comment of `src/lib/markdown/mermaid.ts`. Verify that a search for `Chromium|mermaid-isomorphic` under `src/` and in `astro.config.ts` returns only test files that drive a browser for other reasons.

## 4. Theme (`src/styles/components.css`)

- [x] 4.1 Replace the `[data-diagram] svg` `!important` block with the D6 `--pele-*` variables on `[data-diagram]`. Add the plain rules for `font-feature-settings: "zero"` (on `svg text`, see D6), `.pele-cluster > rect` stroke, `.pele-edge-label text` fill and `.pele-node.alt`. Keep the frame, focus and forced-colors rules unchanged. Rewrite the block comment for Pele. Verify that `pnpm lint` passes and that no `!important` stays under `[data-diagram]`.
- [x] 4.2 Update `conformance.test.ts` (`"zero"` on `[data-diagram] svg text`, no longer `!important`) and the `forced-colors.test.ts` m8 wording ("Mermaid's own colors" becomes "the diagram's token colors"). Verify that both files pass.
- [x] 4.3 Visual check. Run `astro dev --background`, open `/dev/design-system-markdown/` in Chromium, and screenshot the diagram in normal and `forced-colors: active` emulation. Check that the computed fill and stroke of a node `<rect>`, an edge `<path>`, a subgraph `<rect>` and a label `<text>` equal the D6 tokens, that labels fit their boxes, and that the frame border is `CanvasText` under forced colors. Stop the server with `astro dev stop`.

## 5. Dependency removal, tooling and docs

- [x] 5.1 Run `pnpm remove mermaid-isomorphic`. Verify that `pnpm-lock.yaml` no longer lists `mermaid-isomorphic` or `mermaid@`, and that a search for `mermaid-isomorphic` across the repo returns nothing outside `openspec/`.
- [x] 5.2 Rename the `diagrams:browser` script to `test:browser` in `package.json`, `.github/actions/setup/action.yml` and `README.md`. Reword the README row to "Installs the headless Chromium that browser tests and a11y checks use". Reword the setup action's `browser` input description and comment to match. Verify that a search for `diagrams:browser` returns nothing outside `openspec/`.
- [x] 5.3 In `.github/workflows/ci.yml`, set `browser: "false"` on the `build` job, and fix the `structured-data` comment ("doesn't render Mermaid, so no Chromium" becomes "no browser"). Verify that the workflow YAML parses (`pnpm dlx yaml-lint .github/workflows/ci.yml` or an equivalent check), and that the `test` and `a11y` jobs still get the default browser.
- [x] 5.4 Update `DESIGN.md`: the forced-colors sentence on MermaidDiagram's own colors and the Markdown pipeline line on Mermaid rendering. Say that diagrams render with Pele at build and take token colors through CSS variables. Verify by reading the two edited lines against D6.

## 6. Integration

- [x] 6.1 Run `pnpm lint && pnpm check && pnpm test`. Verify that all pass.
- [x] 6.2 With Chromium uninstalled or hidden (`PLAYWRIGHT_BROWSERS_PATH=/nonexistent`), run `pnpm build` and `pnpm build:dev-pages`. Verify that both succeed, and that `dist-dev/dev/design-system-markdown/index.html` contains `<figure data-diagram` with a `class="pele` SVG.
- [x] 6.3 Run `pnpm test:a11y:dev` against `dist-dev/`. Verify zero axe violations on the diagram page.
