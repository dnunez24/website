# Design

## Context

`renderMermaidFigure(source)` in `src/lib/mermaid.ts` is the single render path. The Markdown hast plugin (`src/lib/markdown/mermaid.ts`) and `MermaidDiagram.astro` both call it. Today it:

1. Starts `mermaid-isomorphic`, which drives Playwright Chromium, with a hex `mermaidConfig` and JetBrains Mono embedded as a data-URI stylesheet.
2. Rejects a rendered SVG that has `<a` or `class="clickable"`.
3. Builds the `aria-label` from the `title` and `description` fields that `mermaid-isomorphic` returns.
4. Pins `width` and `height`, strips `max-width`, and adds `aria-hidden`.
5. Wraps the result in `<figure data-diagram role="img" tabindex="0">`.

`components.css` then repaints the SVG with `!important` rules keyed to Mermaid class names (`.node`, `.edgePaths`, `.flowchart-link`, `.cluster`, `.edgeLabel`).

A spike with `pele@1.13.0` in Node 20+ (outside the repo) showed:

| Probe | Result |
| --- | --- |
| `accTitle` / `accDescr` | Emitted as `<title id="{idPrefix}-title">` and `<desc id="{idPrefix}-desc">`, referenced from the root's `aria-labelledby` / `aria-describedby`. `RenderResult` has no title/description fields. Text is entity-escaped. |
| Other `<title>` elements | A journey actor emits a bare `<title>Me</title>` too. Only the id-matched one is the accessible name. |
| Invalid syntax | Throws `PeleError` with `code: "syntax"`, a line and a column. |
| No `accTitle`/`accDescr` | Renders anyway, with no `aria-labelledby`. |
| `click B href …` | `links.length === 1`, and the SVG has `<a>`. |
| `click B call cb()`, sequence `link` / `links` | Dropped: no `<a>`, `links` is empty. |
| `responsive: false` | Root `<svg>` has pixel `width`/`height`, no `max-width`. |
| IDs | The only `id` attributes are the prefixed title and desc. The root `<svg>` has no `id`. Node and edge keys are `data-id`. |
| `<style>` element | None. Colors are `var(--pele-*, fallback)` in inline attributes and styles. |
| `classDef alt` | The node group gets class `alt`. The fill goes in an inline `style`. |
| Determinism | The same source and options give byte-identical SVG. |
| Text measurement in Node | A built-in proportional width table by default. `fontFamily` only changes the emitted CSS, not the measurement. A custom `measurer` is honored. |

## Goals / Non-Goals

**Goals:**

- One render path, synchronous and in-process, with the figure markup unchanged.
- Label metrics that match JetBrains Mono, so boxes fit what the browser draws.
- All diagram color in CSS, through `--pele-*` variables set from tokens.

**Non-Goals:**

- Matching Mermaid's old layouts pixel for pixel.
- Using `pele/core` with per-type registration to trim the build-time bundle. The renderer runs only at build, so bundle size has no user cost.
- Narrow-screen re-layout (`maxWidth`, `autoDirection`). That needs client JS or one render per breakpoint.

## Decisions

### D1. Call `render()` from the main `pele` entry, synchronously

`renderMermaidFigure` becomes a plain `(source: string) => string`. Callers already work with a sync return: the hast `visit` is async, and Astro's `await` accepts a non-promise. Tests change from `.rejects.toThrow` to `toThrow`.

- *Alternative:* keep an `async` wrapper for API stability. Rejected. It is a shim with no caller that needs it.
- *Alternative:* `pele/lazy` + `renderAsync`. Rejected. It only defers module loading, which a build process doesn't need.

Options passed on every call:

```ts
render(source, {
  idPrefix: `mermaid-${sha256(source).slice(0, 8)}`, // current prefix scheme
  responsive: false,
  autoDirection: false,
  fontSize: 13,
  fontFamily: MONO_STACK,      // "JetBrains Mono, ui-monospace, monospace"
  fontFamilyMono: MONO_STACK,
  measurer: jetbrainsMono,     // D2
  links: true,                 // keep links visible so the guard (D4) can see them
  images: false,               // no network requests from a static page
});
```

`autoDirection: false` keeps the author's `LR`/`TB`. `autoDirection` only acts with `maxWidth`, but setting it states the intent.

### D2. Fixed-advance measurer for JetBrains Mono

JetBrains Mono has one advance width for every glyph in every weight: 600 units per 1000 em. The measurer returns `[...text].length * size * 0.6` and ignores the bold and italic flags.

- *Alternative:* shape with `harfbuzzjs` (already used in `share-image/fonts.ts`). This would be exact for glyphs outside the font's Latin subset and for ligatures. Rejected: it is async to load, adds a font read per build, and the site's diagrams are Latin text. Revisit only if a fixture shows overflow.
- *Alternative:* Pele's default table. Rejected: it is proportional, so mono labels get irregular box widths.

Code-point counting (`[...text]`), not `.length`, so a supplementary-plane character counts as one glyph.

### D3. Accessible name from the id-matched `<title>` and `<desc>`

Read `<title id="{prefix}-title">…</title>` and `<desc id="{prefix}-desc">…</desc>` from the SVG. Do not take the first `<title>`: the journey actor case above shows why. Decode the five XML entities Pele emits, join with `": "`, and re-escape for the attribute with the existing `escapeAttribute`. If both are empty, throw:

```text
Name this Mermaid diagram with accTitle or accDescr; they become its accessible name. Add them after the diagram type line, for example:

  accTitle: Checkout flow
  accDescr: The product page hands off to checkout.

{source}
```

The example is fixed text, not built from the author's source. Inserting lines into the source would have to handle frontmatter and `%%{init}%%` directives, and a fixed example is enough to show the syntax.

- *Alternative:* `parse()` the source and read the model's accessibility fields. Rejected: the model shape is not documented as public API, and the SVG is what ships.

### D4. Link guard on `result.links` and the SVG

Fail when `result.links.length > 0` or the SVG matches `/<a[\s/>]/`. Drop `RENDERED_SVG_CLICKABLE`: Pele emits no `clickable` class. A callback-only click is ignored by Pele (see Security docs), so it renders no interactive element.

Callback clicks and sequence `link`s used to fail. Now they pass silently, because the figure the reader gets contains no link. This is the same "judge the rendered output" rule the current code documents. The spec records the new outcome.

- *Alternative:* `links: false`, which strips every link and never fails. Rejected: an author who writes `click … href` should learn the link won't exist, instead of losing it silently.

### D5. Errors

Catch `PeleError` only and rethrow with Pele's own message in the text, plus `{ cause }`:

```text
Mermaid couldn't render this diagram: Parse error on line 3:
  accDescription: Hi
------------------^
Expecting 'SEMI', 'NEWLINE', 'EOF', got 'NODE_STRING'

{source}
```

Pele's `message` already has the line, the failing line and the `^` marker (`snippet`). The spike showed this for `syntax` errors. For `unsupported-diagram` it says "No diagram type detected for the given text." Line numbers count from the first line of the fence, including frontmatter. Do not rebuild the message from `line`, `column` and `snippet`: it would only copy what Pele already formats. Build logs often hide `cause`, so the reason must be in the message itself.

The line is relative to the diagram, not to the Markdown file. A file-relative line needs the fence's start position from satteri, which this worktree couldn't check (no `node_modules`). It stays out of scope.

Let any other error propagate unchanged: it is a Pele bug, not an authoring error. Remove the Chromium install hint.

### D6. Theme through `--pele-*` on the frame

Replace the `[data-diagram] svg` `!important` block with variables on `[data-diagram]`. The variables inherit into the SVG's `var(--pele-*, fallback)`:

| Pele variable | Token (from the current overrides) |
| --- | --- |
| `--pele-bg` | `--color-surface-inset` (frame ground, edge-label ground) |
| `--pele-fg` | `--color-ink` |
| `--pele-muted` | `--color-ink-muted` |
| `--pele-line` | `--color-concrete-600` |
| `--pele-surface` | `--color-surface` |
| `--pele-surface-alt` | `--color-surface-inset` |
| `--pele-border` | `--color-brand` |
| `--pele-accent` | `--color-brand` |
| `--pele-radius` | `--radius-sm` |
| `--pele-font`, `--pele-font-mono` | `--font-mono` |

Kept as plain rules, with no `!important` because nothing competes:

- `font-feature-settings: "zero"` on `[data-diagram] svg text` (DESIGN.md, conformance test). Not on the `<svg>`: Pele's root has an inline `font:13px sans-serif` shorthand, which resets `font-feature-settings` to `normal`, and an inline style beats a stylesheet rule. Found in the visual check: the computed value on the `<svg>` was `normal`.
- `.pele-cluster > rect { stroke: var(--color-line) }`: subgraph borders stay the quieter line token, as today.
- `.pele-edge-label text { fill: var(--color-ink-muted) }`: edge labels stay muted, as today.
- `.pele-node.alt` → `--color-topic-ground` / `--color-fungus-700`, so `:::alt` keeps its meaning. Inline `classDef` fills still win, because inline styles beat stylesheet rules.

`mx-auto block h-auto max-w-none` on the SVG stays, so a wide diagram scrolls and does not shrink. Pele's own cluster `fill-opacity: 0.5` stays. It reads the same over an inset ground. Check this visually in task 4.

- *Alternative:* pass colors through Pele's `config.themeVariables`. Rejected: Pele applies only palette variables, and colors fixed at build would break future theming.

### D7. Remove the dev-page render skip

The skip existed only so Workers Builds would never launch Chromium. With no browser, `mermaidDiagrams()` takes no arguments and renders every fence. `isDevPageFile` and `isDevPagePath` then have no caller and are deleted with their tests. So are `projectRoot` in `astro.config.ts` and the Mermaid sentence in the `dropsDevPages` doc. `dropsDevPages` stays for `excludeDevPages`. A broken diagram on a dev page now fails a production build. That is the same strictness every other page has.

### D8. Browser tooling

The build no longer needs Chromium. `vitest` still does (`a11y.test.ts`, `layer-guard.test.ts`, `prose.test.ts`), and so do `scripts/check-a11y.ts` and the CI `a11y` job. Rename `diagrams:browser` to `test:browser` and reword its README row. In CI, the `build` job sets `browser: "false"`, and the setup action's description and comment now name tests and a11y, not Mermaid.

### D9. Pin `pele` exactly

Use `"pele": "1.13.0"`, with no caret. The layout engine is weeks old, and a minor bump can move every diagram. Upgrades happen on purpose and get a visual check.

## Risks / Trade-offs

- [Pele is new (1.x, published weeks ago); layout bugs or regressions] → Exact pin (D9). Each renderer test asserts behavior, not pixels. The dev specimen page is the visual check before an upgrade.
- [The fixed-advance measurer is wrong for glyphs outside JetBrains Mono (CJK, emoji), which fall back to a wider font] → Accepted. Site diagrams are Latin. A label that overflows shows in the specimen page. The harfbuzz measurer (D2 alternative) is the fix if needed.
- [Authors lose the build error for callback clicks and sequence links] → Accepted per D4. The figure is still link-free, which is what the rule protects.
- [The visual change on every diagram] → Accepted by the owner. Only `/dev/*` specimens use diagrams today.
- [`forced-color-adjust: none` with CSS-variable colors not tested in a real forced-colors session] → Task 4 checks it in Chromium with forced-colors emulation.
- [Pele reads Mermaid 12.1 syntax and we documented 11.x] → Low risk. 12.x is a syntax superset for the types the site uses.

## Migration Plan

This is one PR with no data migration. Rollback: revert the PR, then run `pnpm diagrams:browser`, the old script name, locally.
