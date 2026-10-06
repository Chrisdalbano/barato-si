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

## 2026-10-05: branding and day-header pass (owner feedback)

### What changed

- **Brand as the hero.** A new `Masthead` opens the home page: the lockup "barato, sí." in Inter 700 with the cobalt full stop, a dry one-line lede ("Un índice de precios, no una tienda."), then a ruled dateline strip. The strip (`DayStrip`) holds the date, figures, update time, and one quiet sources line. The old "Ofertas del día" eyebrow and the four-box stats strip are gone. The same voice carries through:
  - **Header tag:** "índice diario de rebajas".
  - **Footer:** a "barato, sí." sign-off, plus a legal line saying barato.si only orders and links what others publish.
  - **Archive:** "Lo que fue barato."
  - **API page:** "Barato, sí. También en JSON."
  - **Empty states:** "Hoy, nada barato de verdad." and "El archivo empieza mañana."
  - **Browser title:** "barato, sí. Las mayores rebajas del día · barato.si".
- **No "chollo" anywhere visitors read.**
  - The label is now "Baratísimo". The single exclamation, "¡Baratísimo!", is on the lead deal only. "Error probable" became "Posible error de precio".
  - Meta and OG description, OG image alt, RSS link title, JSON-LD and the API prose were rewritten.
  - CSS classes are now `flag--baratisimo` / `flag--posible-error`, so the class names do not leak the word.
  - `?tipo=` now takes `baratisimo` / `posible-error`. The old values `chollo` / `error-probable` are still accepted, so old links keep working.
  - The data value `'chollo'` is unchanged. It appears once on `/api`, as the literal enum in the schema table's code cell, with a note on how the web labels it. That is deliberate: developers filter on that value.
  - Spain-only words were replaced: "ficheros" became "archivos", "merezca la pena" was removed, "ser socio" became "membresía", and "tele" became "televisor".
  - `og:locale` is now `es_LA`, with `es_ES` as an alternate.
  - Number formatting is still `es-ES` (decimal comma), to match the pipeline's `reasons` strings.
- **No zeros.**
  - The day strip shows only the figures that have something behind them.
  - Probable price errors get their own `ErrorWatch` section, "Posibles errores de precio", between the lead and the ranked list. The section is skipped entirely when there are none. Its count in the strip links to it.
  - Filters render only when they have content:
    - The Tipo group shows only flags present that day, with counts.
    - Store and category selects need at least two values.
    - Minimum-discount options are limited to thresholds some deal reaches.
  - The default list leaves out the lead and the error-section deals, the same way it already left out the lead.
- **Sources.**
  - One line: "Fuentes de hoy: CheapShark 60 · Steam 10 · Epic 2 · DealNews 36."
  - A source with `ok: false` gets a short "X, sin respuesta hoy." mention. Two or three are named; more than three become "N fuentes sin respuesta hoy."
  - Error text is never shown, and the disclosure is gone.
  - The line reads whatever `sources` array arrives (`sourcesLine()` in `utils/format.ts`). Unknown names render as given.
- **New entry kinds.**
  - `formatPrice()` renders a price of 0 or less as "Gratis".
  - Free deals do not count down: they show "Gratis" at once, and only the strike draws.
  - `hasListPrice()` guards against null, NaN, zero and list prices at or below the sale price.
  - `formatDiscount()` clamps to 0–100.
  - The store filter was already a select; it now shows the store count.
  - A new category select (`?cat=`) appears when deals carry `category`.
- **Defensive fixes found while testing.**
  - **Ordering follows the file.** Mid-pass, the pipeline changed the contract: `deals` is now "balanced top 30, then descending score" (see `lib/types.ts`). The UI now treats file order as the editorial ranking:
    - the lead is `deals[0]`;
    - the JSON-LD lists the first 10;
    - the rank number is the position in the file;
    - the new default sort, "Destacadas", is the file order.
    - "Puntuación" became an explicit sort. `?orden=puntuacion` still works.
    - The API endpoint description says how the file is ordered.
  - **Client refresh.** `useToday()` / `useArchiveIndex()` registered `onMounted` after an `await`, so Vue dropped the hook and the client refresh never ran. The hooks are now registered before the await.
- **OG image and favicon.**
  - `public/og.png` was re-rasterised at 1200x630 with headless Chrome from an HTML composition in Inter. It shows the lockup, "Índice diario de rebajas", and "Las mayores rebajas del día | Posibles errores de precio | JSON · RSS".
  - The source HTML is not committed; it was a scratch file.
  - The favicon is now an ink "b" with a round cobalt full stop on paper, matching the lockup.

### Verified

- **Tests and build:**
  - `npm.cmd test`: 126/126 pass, re-run after the pipeline commit 7527915.
  - `npx.cmd nuxt typecheck`: clean.
  - `npx.cmd nuxt generate`: succeeds.
- **"chollo" audit** (case-insensitive) of the generated pages:
  - `index.html` and `archivo/index.html`: zero matches, including the JSON-LD.
  - `api/index.html`: one match, the enum literal in the schema code cell (see above).
- **Formatting helpers:** a scratch Node script (not committed, since tests/ is not mine) asserts the following:
  - `formatPrice(0)` gives "Gratis", and normal prices format as before.
  - `hasListPrice` returns false for null, NaN and equal prices.
  - A 100 % discount renders as "−100 %".
  - `flagFromQuery` maps the new and legacy values.
  - `sourcesLine` handles 0, 1, 2 and 10 failed sources, `undefined`, and `ok` with count 0.
- **Real Chrome, desktop**, serving a copy of `.output/public`:
  - The masthead and strip render as designed.
  - The real free games show "Gratis" with the strike and "−100 %".
  - No "0,00" and no NaN on the page.
  - No console errors.
- **Real Chrome, temporary fixture** (served copy only, not committed). The fixture added three deals and one failed source:
  - a price-0 / listPrice-59,99 / 100 % deal flagged `error-probable`;
  - a price-0 / listPrice-null deal;
  - a paid / listPrice-null deal flagged `error-probable`;
  - one source with `ok: false`.
  - Results:
    - The lead shows "Gratis" with the struck list price.
    - The "Posibles errores de precio" section appears, and its strip link reads "2 posibles errores de precio".
    - The Tipo filter gains "Posible error de precio 2". `?tipo=posible-error` gives 2 of 110.
    - The null-list rows render with no strike and no discount.
    - The failed source gets "GOG, sin respuesta hoy."
- **Phone width:** measured in 390px same-origin iframes.
  - `/`, `/?tipo=posible-error`, `/archivo?dia=…` and `/api` have no horizontal overflow.
  - The lockup measures 316 of 343px.
  - A wrapped strip line no longer starts with a separator rule.

### Not verified

- **Real phone or a true 390px window.** The window would not resize, so phone layout was checked through iframes, not on a device.
- **Desktop after the last lockup tweak.** After the lockup size changed to `19vw`, the desktop size was not re-captured. It is capped at 12.5rem, the same cap as the version that was checked.
- **Count-down frames.** The count-down was not watched frame by frame.
- **Clipboard copy.** Not exercised.
- **Link previews.** The new OG image was not checked in Slack or X.
- **Favicon in Inter.** The favicon's "b" renders in Arial wherever Inter is not installed. Converting it to a path would fix that.
- **Error-section prominence on real data.** The real data during this pass had no probable errors, so the section has only been seen with the fixture.
- **Share of "Baratísimo".** 71 of 107 deals carry the flag, which dilutes the label. That is a ranking matter for the pipeline, not patched here.

## 2026-10-06: v2 UI (images, grid, price errors, store links)

### What changed

- **Data layer.** `toView()` / `toDealView()` in `useDeals.ts` is the one place v2 fields are normalized with defaults (`errorScore ?? 0`, `errorSignals ?? []`, `storeUrl`/`storeDomain`/`image ?? null`, `ai`/`history` optional, non-https images dropped). It also adds a view-only `direct` (has `storeUrl`, or its source outcome says `direct: true`). `syndication`, `sourceText`, `sourceSignal`, `foundAt` and the model's `product`/`model` still never reach the payload. v1 files render unchanged.
- **Pictures.** `DealImage`: fixed frame (4:3 cards, 16:9 lead), `object-fit: contain` on the surface plate (never cropped), `width`/`height`, lazy, `referrerpolicy="no-referrer"`. On paper the image multiplies into the plate so white product backdrops disappear. Missing or failed image shows the store's domain in mono on the plate (`storeMark()`: `storeDomain`, else the `storeUrl` host, else the store name; never the aggregator host). Failures before hydration are caught on mount.
- **Grid.** `DealGrid` + `DealCard`: `<ol>` of ruled cells, `repeat(auto-fill, minmax(240px, 1fr))` (two columns on phones), `content-visibility: auto`. Cards render the final price (`DealPrice still`): no count-down on 400 cards; the CSS settle-in runs on the first 12 only. `?vista=cuadricula|lista` toggles (grid default, list = the existing `DealRow`, now with a small thumbnail). Both views render 60 at a time with "Mostrar 60 más"; any filter, sort or view change starts again at 60.
- **Store links.** `linkFor(deal) = storeUrl ?? url` everywhere (title, picture, button, JSON-LD). The action always reads "Ver en <store>"; "vía <source>" stays in the meta line, linked to `sourceUrl`.
- **Filters.** Category labels in Spanish (`CATEGORY_LABEL`, unknown strings pass through), "Solo tiendas directas" (`?directas=1`, shown only when it narrows the list), sort "Sospecha" (`errorScore`, shown only when some deal has one). Still no empty options.
- **Price errors.** New `/errores` ("Cazador de errores de precio"): reads `/api/errors.json`; when missing, falls back to `deals.json` filtered to `errorScore >= 40`. At build time the file is pulled with `import.meta.glob`, which resolves to nothing instead of failing the build when the file is absent. `ErrorCard` shows picture, price vs list, `ErrorMeter` (mono number plus a thin ruled bar, `role="meter"`), the signals as a ruled list (strongest first, bold), the model note under "modelo · 78 %", the history line ("Visto desde el 3 oct, mínimo 99 US$."), then "Ver en <store>" and "vía <source>". Filters `?min=40|55|70` and `?cat=`, read after mount.
- **Home.** `ErrorWatch` is now a 2-3 column grid of up to 6 error cards for `flag === 'error-probable'`. With no 70+ it shows the top 6 at 55+ titled "Sospechosas" with its own note. Either way there is a "Todos los sospechosos →" link. The strip figure links to `/errores` ("N posibles errores de precio", or "N precios sospechosos" at 40+ when there are none). In the archive it still jumps to the day's own `#errores`.
- **Lead.** 16:9 picture above the big price in the left column, text and "Ver en <store>" on the right.
- **Shell and API copy.** Nav gains "Errores"; footer gains "RSS de errores"; `errors.xml` is a second RSS alternate in `nuxt.config.ts`. `ENDPOINTS`/`SCHEMA` cover `storeUrl`, `storeDomain`, `errorScore`, `errorSignals`, `ai`, `history`, `image`, `/api/errors.json`, `/errors.xml`, `/api/raw/YYYY-MM-DD.json`; the API page explains `version`, `classifier`, `sources[].direct`, and that `syndication.itemXml` moved to `/api/raw/`. The curl example now reads `errors.json`.

### Verified

- `npx.cmd nuxt typecheck`: exit 0. Because it prints nothing, also checked that `npx.cmd vue-tsc --noEmit -p .nuxt/tsconfig.app.json` catches a planted error (probe file, deleted) and passes clean.
- `npx.cmd nuxt generate`: succeeds against the current v2 `public/api/deals.json` (400 deals, all with images, 359 with `storeUrl`, max `errorScore` 25, `errors.json` present and empty). `index.html` has 60 grid cards with `<img>`, "Mostrar 60 más", "Solo tiendas directas 359"; `/errores/index.html` shows the empty state, because today has no suspects.
- Error cards on a fixture copy in a scratch directory (not this repo): (A) with `errors.json` holding 86/72/58/44 deals, and (B) with no `errors.json` and only 62/57/41. A: home section "Posibles errores de precio" with two cards and meters; `/errores` has 4 wide cards, the signals, "modelo · 78 %", the history line, the min-score and category filters, and the domain fallback for a null image and a broken image URL. B: home "Sospechosas" (62, 57), strip "3 precios sospechosos", `/errores` 3 cards from the fallback.
- Real Chrome (served copy of the fixture build): lead, error grid and deal grid look right at 1568px wide; list toggle, "Mostrar 60 más", the direct-stores toggle and the reset to 60 on a view change all work; no console messages. 390px iframes: `/`, `/errores`, `/?vista=lista` and `/archivo?dia=2026-10-06` have no horizontal overflow (the list view's "Ver en <store>" overflowed at first and now wraps).

### Not verified

- Night variant with images (multiply is switched off there; not looked at).
- The real `errors.json` with real entries (none today); the fixture covers the shape.
