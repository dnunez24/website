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

Cloudflare Workers Builds (Cloudflare's GitHub app, not GitHub Actions) builds and deploys the `website` Worker straight from this repo. The dashboard has two tabs, each with its own build command and its own token setting:

| Tab           | Build command | Deploy/preview command       |
| :------------ | :------------ | :--------------------------- |
| Production    | `pnpm build`  | `pnpm exec wrangler deploy`  |
| Previews Base | `pnpm build`  | `pnpm exec wrangler preview` |

The production branch is set to `prod`: a push there runs the Production tab's commands, which deploys `website` to the `davidanunez.com` custom domain. Every other branch, including `main`, runs the Previews Base tab's commands instead, which creates a Worker Preview at `<branch-slug>-website.dnunez24.workers.dev`, behind Cloudflare Access. `main`'s Preview is staging. Workers Builds comments the Preview URL on the pull request and posts a `Workers Builds: website` check run.

**Cloudflare Access on `website` must be set to Previews only (the `preview_worker` destination) — never "All traffic," and never the account-wide "protect all Workers" option.** Access covers every hostname a Worker answers on, including its Custom Domain, so either of those broader settings would put `davidanunez.com` itself behind an Access login the moment the first release attaches it. Confirm the mode before that release merges; after it, `curl -sI https://davidanunez.com/` should return a plain `200`, not a redirect to `*.cloudflareaccess.com`.

Previews Base settings apply to new Previews only — an existing branch's Preview keeps whatever settings were live when it was first built. To pick up a Previews Base change on an existing branch, delete that branch's Preview (dashboard, or `pnpm exec wrangler preview delete --name <slug>`) and push again.

Releases are a pull request from `main` to `prod`, merged with a merge commit.

### Every branch build holds a production-capable token (accepted risk)

Both dashboard tabs currently point at the same Cloudflare-generated API token (account-wide Workers Scripts edit, enough to deploy `website`, plus KV, R2 and Workers Routes edit). Workers Builds runs that token in every branch's build, not just `prod`'s — Dependabot's dependency-bump branches included — because `pnpm build` executes whatever code a branch's dependencies import, before `wrangler preview` or `wrangler deploy` ever runs. The old GitHub Actions stack skipped preview deploys for `dependabot[bot]`; this stack doesn't. Workers Builds' branch filters (Settings → Build → Branch control) take exact names or `*`, not prefix patterns: a `dependabot/*`-style carve-out is reportedly rejected ([workers-sdk#15722](https://github.com/cloudflare/workers-sdk/issues/15722)), and each Dependabot bump gets its own branch name (the bumped package and version baked in), so there's no fixed set of exact names to list either. Its build watch paths filter by changed file path only, not by branch, so that's not a way around it.

Accepted, on the strength of two mitigations already in place, plus a dashboard setting this depends on:

- pnpm's install-time supply-chain check (arrived in pnpm 11.3): verifies the lockfile against `minimumReleaseAge` (default 1440 minutes since pnpm 11.0, keeping a just-published package version uninstallable for about a day) and `trustPolicy` (not set here). This is local policy verification pnpm performs itself, not a hosted "policy service." **It depends on Workers Builds actually running pnpm 12.6.0, not its documented default of 10.11.1**, which predates both checks (Cloudflare's build-image docs). `claude/workers-builds-test-6`/`-7`'s build logs show `Detected the following tools from environment: pnpm@12.6.0` and `Verifying lockfile against supply-chain policies`, matching this repo's `packageManager` field, so it has been working there in practice; Cloudflare's docs describe the build variable `PNPM_VERSION` as the supported override and say nothing about `packageManager` detection, so **set `PNPM_VERSION=12.6.0` explicitly on both dashboard tabs** rather than rely on that.
- `pnpm-workspace.yaml`'s `allowBuilds` limits which dependencies may run an *install* script. It does nothing about code a dependency runs normally, which is most of what `pnpm build` executes, but it closes one common route in.

**Possible later mitigation:** give the Previews Base tab its own, narrower API token instead of sharing Production's.

- What it buys: the preview token could drop zone-level permissions like Workers Routes edit, since previews never touch routes, and it could be rotated or revoked without touching production deploys.
- What it doesn't buy: creating a Preview still needs Workers Scripts edit — the same permission that lets `wrangler deploy` replace production code. Cloudflare documents no preview-only permission today. Not applied here.

## 👀 Want to learn more?

Check out [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).

`scripts/vendor/schemaorg-30.1.jsonld.gz` is the [schema.org](https://schema.org/) vocabulary, version 30.1, copyright [Schema.org Sponsors](https://schema.org/docs/terms.html) and licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
