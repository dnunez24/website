# Proposal

## Why

Mermaid diagrams render at build in headless Chromium (`mermaid-isomorphic` + Playwright). Cloudflare Workers Builds cannot install Chromium, so today a diagram can only appear on `/dev/*` pages, which production drops. Pele (`pele` on npm, MIT, 0 dependencies) renders the same Mermaid syntax to SVG in-process in Node. With Pele, diagrams can ship on production pages, renders take milliseconds, and the diagrams take the layout the site owner prefers.

## What Changes

- Replace `mermaid-isomorphic` with `pele` in `renderMermaidFigure` (`src/lib/mermaid.ts`). Rendering becomes synchronous and in-process. The exported function stays async-compatible, so callers do not change shape.
- Keep the figure contract: `<figure data-diagram role="img" tabindex="0" aria-label=…>` around an `aria-hidden` SVG at its natural pixel size. The label comes from `accTitle` and `accDescr`.
- Keep the authoring guards: a diagram with no `accTitle` or `accDescr` fails the build, invalid syntax fails the build, and a diagram whose rendered SVG carries a link fails the build.
- Size labels with a JetBrains Mono text measurer, so boxes fit the font the page shows.
- Theme diagrams with Pele's `--pele-*` CSS variables mapped to site tokens. Remove the hex `mermaidConfig` and the `!important` overrides keyed to Mermaid's class names.
- **BREAKING (visual):** every diagram gets Pele's layout, not Mermaid's. The owner accepts this.
- **BREAKING (authoring):** Mermaid `click … call` callbacks and sequence `link`/`links` no longer fail the build. Pele drops them, so the figure carries no link. A `click … href` still fails.
- Production builds render Mermaid fences on every page, including `/dev/*` sources. The skip that kept Chromium off Workers Builds is no longer needed and is removed.
- The build no longer needs a browser. Playwright Chromium stays for the tests and a11y scripts that drive a real browser. The `diagrams:browser` script is renamed to `test:browser`, and the CI `build` job stops installing Chromium.
- Remove the `mermaid-isomorphic` dependency and the embedded-font data-URI helper.

## Capabilities

### New Capabilities

- `mermaid-diagrams`: Mermaid source (Markdown fences and the `MermaidDiagram` component) renders at build to an accessible, static, themed SVG figure. This covers the figure markup, the authoring guards, sizing and theming.

### Modified Capabilities

None. `openspec/specs/` is empty.

## Impact

- Code: `src/lib/mermaid.ts`, `src/lib/markdown/mermaid.ts`, `src/components/MermaidDiagram.astro` (comment only), `src/styles/components.css`, `src/lib/routes.ts` (`isDevPageFile`, `isDevPagePath` and the `dropsDevPages` doc lose their Mermaid caller), `astro.config.ts`.
- Tests: `src/lib/mermaid.test.ts`, `src/lib/markdown/mermaid.test.ts`, `src/lib/routes.test.ts`, `src/lib/no-js.test.ts`, `src/components/components.test.ts`, `src/styles/conformance.test.ts`, `src/styles/forced-colors.test.ts`.
- Dependencies: add `pele` (exact version pin), remove `mermaid-isomorphic` (and transitively `mermaid` 11.17.2, `katex`, Font Awesome). `playwright` stays.
- CI and docs: `.github/actions/setup/action.yml`, `.github/workflows/ci.yml`, `package.json` scripts, `README.md`, `DESIGN.md`.
- Out of scope: client-side rendering, Pele's `mount()`, zoom, responsive auto-direction, dark mode, and math or icon resolvers.
