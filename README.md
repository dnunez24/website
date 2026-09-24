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

| Command                 | Action                                                                                        |
| :---------------------- | :-------------------------------------------------------------------------------------------- |
| `pnpm install`          | Installs dependencies                                                                         |
| `pnpm diagrams:browser` | Installs the headless Chromium that renders Mermaid diagrams at build; run once after install |
| `pnpm dev`              | Starts local dev server at `localhost:4321`                                                   |
| `pnpm build`            | Build your production site to `./dist/`                                                       |
| `pnpm preview`          | Preview your build locally, before deploying                                                  |
| `pnpm preview:edge`     | Preview the build through Wrangler, the way it will be served in production                   |
| `pnpm astro ...`        | Run CLI commands like `astro add`, `astro check`                                              |
| `pnpm astro -- --help`  | Get help using the Astro CLI                                                                  |
| `pnpm deploy-tool:lock` | Regenerate `.github/deploy/pnpm-lock.yaml` after bumping wrangler in `.github/deploy/package.json` |

## Deploys

`.github/workflows/deploy.yml` deploys to three Cloudflare Workers environments. Preview and staging run the `website` Worker; production runs a separate `website-production` Worker (wrangler's `env.production`), so Cloudflare Access has to be configured on `website` specifically — turning it on there doesn't touch production.

| Environment | Triggers on                             | Worker               | URL                                            |
| :---------- | :--------------------------------------- | :-------------------- | :---------------------------------------------- |
| Preview     | Every same-repo pull request into `main` | `website`             | `pr-<number>-website.<subdomain>.workers.dev`  |
| Staging     | Push to `main`                           | `website`             | `website.<subdomain>.workers.dev`               |
| Production  | Push to `prod`                           | `website-production`  | [davidanunez.com](https://davidanunez.com/)     |

Preview and staging share `website`'s `workers.dev` subdomain, which must sit behind Cloudflare Access — "All traffic" on the `website` Worker specifically. ("Previews only" would leave staging's own URL public; the account-wide "require sign-in on every Worker" option would also cover `website-production`, putting the production site behind Access, which is never what's wanted.) Each deploy's URL also shows up on that run's [GitHub environment](https://github.com/dnunez24/website/deployments) and, for previews, on the pull request itself.

## 👀 Want to learn more?

Check out [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
