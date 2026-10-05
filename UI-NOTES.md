# UI notes

## What was built

- `app/app.vue`: the shell. Header with the wordmark, nav (Hoy, Archivo, API, RSS), skip link. Footer with the Spanish legal line, links to `deals.json`, RSS and `llms.txt`, and "Hecho por Chris D'Albano".
- `app/pages/index.vue`: today's page. `DayHeader` shows the date, counts, generation time (UTC) and the working sources. Disabled sources sit behind a `fuentes` `<details>`. Then `LeadDeal` (the top deal, set large), `DealList`, and `ApiTeaser`. An empty day shows a calm message, not an error. JSON-LD (`WebSite` + an `ItemList` of the top 10 as `Offer`s) is built from the same data as the page.
- `app/pages/archivo.vue`: days come from `/api/index.json` (bundled at build, then refreshed). The chosen day lives in `?dia=` and is fetched in the browser from `/api/deals/YYYY-MM-DD.json`.
- `app/pages/api.vue`: endpoints, copyable curl and fetch examples, a compact schema table, update time, and the attribution / fair-use text.
- Components:
  - `DealPrice`: price count-down and strike-line draw.
  - `DealMeta`: publisher facts first, then barato.si's analysis.
  - `DealRow`
  - `LeadDeal`
  - `DealList`: filters plus the list with motion.
  - `DayHeader`
  - `CodeBlock`
  - `ApiTeaser`
- Composables and utils:
  - `useDeals`: loading.
  - `useDealFilters`: query-string state.
  - `utils/format`: Intl helpers, all pinned to `es-ES` and UTC.
  - `utils/api`: shared API copy.
- `nuxt.config.ts`: title, description, theme-color, OG and Twitter tags, RSS and JSON autodiscovery, `hreflang` es and x-default, favicon. Each page sets its own canonical.
- `public/og.png`: a 1200x630 PNG, rasterised with headless Chrome from an HTML composition in Inter. `public/favicon.svg` is also new.

### Data flow

During `nuxt generate`, the server branch of `useToday()` dynamically imports `public/api/deals.json`. The prerendered HTML therefore contains the real deals. The workflow runs `npm run deals` before generate, so this is always the fresh file.

On mount, the client fetches `/api/deals.json` and replaces the data if `generatedAt` changed. Before anything reaches the page payload, `toView()` strips `syndication`, `image`, `sourceSignal` and `foundAt`. The page never uses `itemXml` or `descriptionHtml`, and nothing uses `v-html`.

### Contract rules

- Titles and URLs are rendered exactly as given.
- Outbound links use `rel="noopener" target="_blank"`.
- Attribution reads "vía DealNews", linked to `sourceUrl`.
- The score and reasons sit on a separate line labelled "BARATO.SI", apart from the publisher facts.

### Filters

All filter state is in the query string:

| Key | Values |
| --- | --- |
| `tipo` | `error-probable` or `chollo` |
| `tienda` | a store name |
| `min` | 25, 50 or 75 |
| `q` | search text (debounced) |
| `orden` | `puntuacion` (default), `descuento` or `recientes` |

The query is read only after mount. This keeps the prerendered HTML and hydration identical, and a shared filtered link applies about a frame after load.

Rank numbers are each deal's position in the day's score order, whatever the sort. When no filter is active, the lead deal is left out of the list.

### Motion

- **Prices:** a price counts down from list price to sale price when it scrolls into view, using motion-v `animate`.
- **Strike line:** the list-price strike is a pseudo-element that draws left to right.
- **Settle-in:** rows settle in on first paint with a staggered CSS animation. It is transform-only, so rows stay readable if animations are paused.
- **Re-ordering:** sort and filter changes animate with motion-v `layout="position"`, with `AnimatePresence` handling enter and exit.
- **Reduced motion:** `prefers-reduced-motion` turns off the count-down, the strike draw and the settle-in. `MotionConfig reduced-motion="user"` covers the layout animations.

## Verified

- `npm.cmd test`: 78/78 pass.
- `npx.cmd nuxt typecheck`: clean.
- `npx.cmd nuxt generate`: succeeds. It prerenders `/`, `/api` and `/archivo`.
- `.output/public/index.html` (checked by reading it):
  - 35 rows plus the lead, with real publisher titles.
  - The JSON-LD block with the top 10.
  - Canonical, hreflang, OG and Twitter tags, RSS autodiscovery and theme-color.
  - No `itemXml` or `descriptionHtml` in the HTML or `_payload.json`.
- In a real Chrome tab, serving a copy of `.output/public`:
  - The count-down and strike animations ran.
  - No console messages.
  - Query-string filters applied on load (`?tipo=chollo&orden=descuento` gave 6 results, sorted).
  - Sort, store, minimum discount and search all update the URL and the list (Amazon gave 9 of 36). The empty-filter state and "Quitar filtros" work.
  - `tipo=error-probable` shows the empty state, because today has no error-probable deals.
  - Archive: clicking a day loads `/api/deals/2026-10-05.json` and renders 36 rows.
  - The `fuentes` disclosure opens.
- Phone width: measured in a 390px iframe inside that tab. `/`, `/api` and `/archivo` have no page-level horizontal overflow. Only code inside the `<pre>` blocks extends past the edge, and it scrolls inside its box.
- Desktop layout was checked visually at 1440px (screenshots of `/` and `/api`).

## Not verified

- **Phone layout, visually.** Headless Chrome enforces a minimum window width, so its 390px capture rendered wider than 390 and was cropped. I could not resize the real window either. Phone layout was verified by measurement only (above).
- **Animations in the live tab.** That tab was a background tab, so rAF and CSS animation time were frozen. Exit animations finished once the tab was brought forward for a screenshot. Re-order smoothness was not watched frame by frame.
- **No-JS rendering.** Not tested in a browser. The HTML is complete without JS. The price counter and strike only "arm" after mount.
- **Clipboard copy.** Not exercised; it needs a user gesture in a visible tab.
- **Link-preview rendering.** Not checked on real services (Slack, X).

## Pipeline observations

Not patched. These are notes only.

1. `reasons` uses a dot decimal ("Ahorro de 42.54 USD"), while the UI formats money as es-ES ("42,54 US$"). Both appear on the same row.
2. The reason "Publicada en las últimas 24 h" is frozen at generation time. In archived days it stays true forever, though it was only true on the day.
3. `sourceUrl` is the feed URL (`https://www.dealnews.com/?rss=1&sort=time`), not the item page, so "vía DealNews" opens a raw RSS feed. A link to `https://www.dealnews.com/` or the item `guid` would be friendlier. The UI uses `sourceUrl` as the contract says.
4. Titles carry their own value but `listPrice` is null. For example, "IHOP Four $25 Gift Cards ($100 Value) for $80" has no list price or discount. This may be intended by the conservative parser.
5. `sources[].error` strings are English. They only show inside the `fuentes` disclosure.
6. This is not a bug: a 48%-off pair of shoes (Dockers, $24 saved) is `normal`, while a 39%-off TV is `chollo`. That follows the rule (pct >= 50, or saved >= 40 and pct >= 30), but readers may find it odd.

## Housekeeping

`nuxt generate` fails with EBUSY on Windows if any process has `.output/public` as its working directory (for example a local static server). Serve a copy instead.
