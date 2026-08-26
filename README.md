# HoursEmbed

Brings the Salt + Scoria hours block out of Drupal (trlibrary.com) into a JavaScript embed for [saltandscoria.com](https://www.saltandscoria.com/contact) on Squarespace.

## How it works

trlibrary.com doesn't allow cross-origin requests, so the embed can't read the Drupal page directly from the browser. Instead:

1. A scheduled **GitHub Action** ([`sync-hours.yml`](.github/workflows/sync-hours.yml)) runs every 6 hours. It fetches `https://www.trlibrary.com/visit/eat`, parses the `.hours-block` markup (seasonal tabs, lite/full service rows, holiday closures) plus the page's restaurant JSON-LD, and writes [`docs/hours.json`](docs/hours.json). If the page structure changes and parsing fails, the script exits non-zero and the last good `hours.json` stays published.
2. **GitHub Pages** (serving the `docs/` folder) hosts `hours.json` and `embed.js` with `Access-Control-Allow-Origin: *`.
3. [`embed.js`](docs/embed.js) runs on the Squarespace page, fetches `hours.json` from the same Pages origin, and renders seasonal tabs in Shadow DOM (isolated from Squarespace CSS, inherits the site's font). The current season is auto-selected by date, with a year-agnostic fallback if the published season years go stale.

## Squarespace embed

Add a **Code block** on the Contact page:

```html
<div data-trpl-hours></div>
<script src="https://theodore-roosevelt-presidential-library.github.io/HoursEmbed/embed.js" defer></script>
```

Options on the container div:

| Attribute | Effect |
|---|---|
| `data-accent="#8a3324"` | Accent color for the active tab and headings |
| `data-heading="hide"` | Hide the "Salt + Scoria Restaurant" heading |

Finer styling via CSS custom properties on the container: `--trpl-accent`, `--trpl-text`, `--trpl-muted`, `--trpl-border`, `--trpl-radius`, `--trpl-font`.

## One-time setup

1. Repo → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/docs`.
2. **Settings → Actions → General → Workflow permissions**: *Read and write permissions* (the sync workflow commits `hours.json`).
3. Run the **Sync hours** workflow once manually (Actions tab → *Sync hours from trlibrary.com* → Run workflow) to publish live data.

Demo: `https://theodore-roosevelt-presidential-library.github.io/HoursEmbed/`

## Local development

```sh
node scripts/extract-hours.mjs                        # fetch live page → docs/hours.json
node scripts/extract-hours.mjs --fixture test/fixture.html   # parse saved markup
```

`test/fixture.html` is a captured copy of the live `.hours-block` for testing the parser offline.
