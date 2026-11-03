# Spec Delta

## Purpose

Turns Mermaid source written in Markdown fences or passed to the MermaidDiagram component into an accessible, static SVG figure at build time. The figure needs no JavaScript and uses the site's design tokens.

## ADDED Requirements

### Requirement: Mermaid sources render at build
The build SHALL render every `mermaid` Markdown fence and every MermaidDiagram component to an inline SVG figure in the page HTML. The output SHALL contain no script and SHALL need no client-side JavaScript. Other code fences SHALL stay highlighted code.

#### Scenario: Markdown fence becomes a figure
- **WHEN** a Markdown page has a `mermaid` fence and a `ts` fence
- **THEN** the HTML has a `figure[data-diagram]` with an inline `<svg>` where the mermaid fence was
- **AND** the HTML has no `language-mermaid` code block
- **AND** the `ts` fence is still a `<pre><code class="language-ts">` block

#### Scenario: Component and fence share one markup
- **WHEN** a page renders the MermaidDiagram component with Mermaid source
- **THEN** it outputs the same figure markup as a Markdown fence with that source

#### Scenario: Figure carries no script
- **WHEN** a page with a rendered diagram is checked for scripts and inline event handlers
- **THEN** the check reports no issues
- **AND** a script placed after the figure is still detected

### Requirement: Rendering needs no browser
The build SHALL render diagrams without launching a browser. A production build, such as Cloudflare Workers Builds, SHALL render diagrams on every page that has them.

#### Scenario: Production build without Chromium
- **GIVEN** no Playwright browser is installed
- **WHEN** a production build runs on a page with a `mermaid` fence
- **THEN** the build succeeds and the page contains the rendered figure

#### Scenario: Dev-page sources in a production build
- **WHEN** a production build processes a `mermaid` fence in a `src/pages/dev/` source
- **THEN** the fence renders to a figure, the same as on any other page
- **AND** the dev page is still left out of `dist/`

### Requirement: Figure is one named image
Each figure SHALL have `role="img"`, `tabindex="0"` and an `aria-label`. The label SHALL be the diagram's `accTitle` and `accDescr` joined by `": "`, or whichever of the two exists. The SVG inside SHALL have `aria-hidden="true"`, so assistive technology does not read its parts a second time.

#### Scenario: Title and description form the label
- **WHEN** a diagram has `accTitle: Checkout flow` and `accDescr: The product page hands off to checkout.`
- **THEN** the figure's `aria-label` is `Checkout flow: The product page hands off to checkout.`
- **AND** the figure has `role="img"` and `tabindex="0"`
- **AND** its SVG has `aria-hidden="true"`

#### Scenario: Title alone forms the label
- **WHEN** a diagram has `accTitle: Two steps` and no `accDescr`
- **THEN** the figure's `aria-label` is `Two steps`

#### Scenario: Diagram title text is not the label
- **WHEN** a journey diagram has `title My journey`, `accDescr: A journey diagram.`, and an actor named `Me`
- **THEN** the figure's `aria-label` is `A journey diagram.`

#### Scenario: Label text round-trips
- **WHEN** an `accTitle` contains `"`, `<`, `>` or `&`
- **THEN** the `aria-label` attribute value, once parsed, equals the `accTitle` text exactly

### Requirement: Unnamed diagrams fail the build
The build SHALL fail on a diagram that has neither `accTitle` nor `accDescr`. The error SHALL name `accTitle or accDescr`, SHALL show a two-line example of both keywords, and SHALL include the diagram source. For a Markdown fence it SHALL also include the source file path.

#### Scenario: No accessible name
- **WHEN** a diagram is `flowchart LR` with `A --> B` and no `accTitle` or `accDescr`
- **THEN** rendering fails with an error that matches `accTitle or accDescr`
- **AND** the error contains an example line starting with `accTitle: ` and an example line starting with `accDescr: `
- **AND** the error ends with the diagram source

#### Scenario: Markdown error names the file
- **WHEN** an unnamed `mermaid` fence is in a Markdown file
- **THEN** the error message starts with that file's path

### Requirement: Invalid Mermaid fails the build
The build SHALL fail on Mermaid source that cannot be parsed or drawn. The error message SHALL say the diagram couldn't render, SHALL give the parser's reason, and SHALL include the diagram source. When the parser knows the position, the message SHALL also give the line number in the diagram source and the failing line with a marker under the column.

#### Scenario: Syntax error
- **WHEN** a diagram is `flowchart LR` with `accTitle: Broken` and a dangling `A -->` on line 3
- **THEN** rendering fails with an error that matches `couldn't render`
- **AND** the message contains `line 3`, the line `  A -->`, and a marker line ending in `^` under the column
- **AND** the message ends with the diagram source

#### Scenario: Misspelled keyword
- **WHEN** a diagram has `accDescription: Hi` on line 3
- **THEN** the message contains `line 3` and the line `  accDescription: Hi`

#### Scenario: Line numbers count frontmatter
- **WHEN** a diagram starts with a three-line frontmatter block and has a syntax error on its fifth line
- **THEN** the message contains `line 5`

#### Scenario: Unknown diagram type
- **WHEN** a diagram starts with a word that is not a Mermaid diagram type
- **THEN** rendering fails with an error that matches `couldn't render`
- **AND** the message says no diagram type was detected

### Requirement: Figures carry no links
The build SHALL fail on a diagram whose rendered SVG contains a link. The check SHALL look only at the rendered output, not the source text. The error SHALL say the figure can't carry its own link and point the author to the caption or the text around the diagram.

#### Scenario: Flowchart click href
- **WHEN** a flowchart has `click B href "https://example.com/docs"`
- **THEN** rendering fails with an error that matches `can't carry its own link`

#### Scenario: Directives that render no link
- **WHEN** a flowchart has `click B call myCallback()`, or a sequence diagram has `link Buyer: Docs @ https://example.com/docs`
- **THEN** the diagram renders to a figure
- **AND** the figure's SVG contains no `<a>` element

#### Scenario: Prose that starts with "click"
- **WHEN** an `accDescr` block line, a markdown-string label line, or a journey task starts with `click`
- **THEN** the diagram renders to a figure

### Requirement: Diagrams on one page have distinct IDs
Each figure's SVG SHALL use IDs unique to its source, so two diagrams on one page do not share IDs or ARIA references. The same source SHALL always produce the same IDs.

#### Scenario: Two diagrams
- **WHEN** two diagrams with different sources render
- **THEN** no `id` attribute value appears in both SVGs
- **AND** each SVG's `aria-labelledby` points to its own `<title>`

#### Scenario: Stable across builds
- **WHEN** the same source renders twice
- **THEN** both outputs are byte-identical

### Requirement: Diagrams keep their natural size
The SVG SHALL have fixed pixel `width` and `height` equal to the diagram's natural size. It SHALL NOT scale down to fit the column. A diagram wider than the column SHALL scroll inside its focusable frame. Labels SHALL render at 13px in the site's mono font, and each box SHALL be measured to fit its label in that font.

#### Scenario: Fixed size
- **WHEN** a diagram renders
- **THEN** its SVG has numeric `width` and `height` attributes and no `max-width` style

#### Scenario: Labels fit their boxes
- **WHEN** two flowchart nodes have labels of equal character count but different glyphs, such as `iiii` and `WWWW`
- **THEN** both nodes have the same width, as monospace glyphs need

### Requirement: Diagrams take the site's colors
Diagram colors SHALL come from the site's design tokens through CSS, not from colors fixed in the renderer. Text, lines, node fills, node borders, subgraph fills and edge-label grounds SHALL each map to a token. Colors an author sets in the source (`style`, `classDef`) SHALL still apply.

#### Scenario: Token colors
- **WHEN** a flowchart with a subgraph renders on a page
- **THEN** its computed text, line, node fill, node border and subgraph fill colors equal the mapped site tokens

#### Scenario: Forced colors
- **WHEN** the page renders with `forced-colors: active`
- **THEN** the frame keeps its token colors as one island (`forced-color-adjust: none`)
- **AND** the frame border is `CanvasText` and the focus ring is `Highlight`
