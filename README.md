# Astro Starter Kit: Blog

```sh
pnpm create astro@latest -- --template blog
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

Features:

- ✅ Minimal styling (make it your own!)
- ✅ 100/100 Lighthouse performance
- ✅ SEO-friendly with canonical URLs and Open Graph data
- ✅ Sitemap support
- ✅ RSS Feed support
- ✅ Markdown & MDX support

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── README.md
├── package.json
└── tsconfig.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory.
Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

The `src/content/` directory contains "collections" of related Markdown and MDX documents.
Use `getCollection()` to retrieve posts from `src/content/blog/`, and type-check your frontmatter using an optional schema.
See [Astro's Content Collections docs](https://docs.astro.build/en/guides/content-collections/) to learn more.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                         | Action                                                                                                 |
| :------------------------------ | :----------------------------------------------------------------------------------------------------- |
| `pnpm install`                  | Installs dependencies                                                                                  |
| `pnpm diagrams:browser`         | Installs the headless Chromium that renders Mermaid diagrams at build; run once after install          |
| `pnpm dev`                      | Starts local dev server at `localhost:4321`                                                            |
| `pnpm build`                    | Build your production site to `./dist/`                                                                |
| `DN_DEV_PAGES=1 pnpm build`     | Build with the `/dev/*` design-system specimens included, for accessibility testing                    |
| `pnpm validate:structured-data` | Validates the built pages' JSON-LD against schema.org; run after `pnpm build`                          |
| `pnpm test:a11y`                | Checks the built pages for accessibility violations with axe-core; run after `pnpm build`              |
| `pnpm test:no-js`               | Fails if any built page ships a script or inline event handler; run after `pnpm build`                 |
| `pnpm test:perf`                | Checks the built pages against performance/a11y/SEO budgets with Lighthouse CI; run after `pnpm build` |
| `pnpm serve:dist`               | Serves `./dist/` the way it's deployed (trailing slashes, a real 404), at `localhost:4173`             |
| `pnpm preview`                  | Preview your build locally, before deploying                                                           |
| `pnpm preview:edge`             | Preview the build through Wrangler, the way it will be served in production                            |
| `pnpm astro ...`                | Run CLI commands like `astro add`, `astro check`                                                       |
| `pnpm astro -- --help`          | Get help using the Astro CLI                                                                           |

## Deploys

Cloudflare Workers Builds (Cloudflare's GitHub app, not GitHub Actions) builds and deploys the `website` Worker straight from this repo. The dashboard has two tabs, each with its own build command and its own Cloudflare API token:

| Tab            | Build command | Deploy/preview command       |
| :------------- | :------------ | :---------------------------- |
| Production     | `pnpm build`  | `pnpm exec wrangler deploy`   |
| Previews Base  | `pnpm build`  | `pnpm exec wrangler preview`  |

The production branch is set to `prod`: a push there runs the Production tab's commands, which deploys `website` to the `davidanunez.com` custom domain. Every other branch, including `main`, runs the Previews Base tab's commands instead, which creates a Worker Preview at `<branch-slug>-website.dnunez24.workers.dev`, behind Cloudflare Access. `main`'s Preview is staging. Workers Builds comments the Preview URL on the pull request and posts a `Workers Builds: website` check run.

Previews Base settings apply to new Previews only — an existing branch's Preview keeps whatever settings were live when it was first built, so a Previews Base change needs a new branch (or that branch's Preview reset) to take effect.

Releases are a pull request from `main` to `prod`, merged with a merge commit.

## 👀 Want to learn more?

Check out [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).

`scripts/vendor/schemaorg-30.1.jsonld.gz` is the [schema.org](https://schema.org/) vocabulary, version 30.1, copyright [Schema.org Sponsors](https://schema.org/docs/terms.html) and licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
