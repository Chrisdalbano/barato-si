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


## 2026-10-14: games aside, smarter filters

### What changed

- Home passes hideGames to DealList. The default list excludes videojuegos before pagination, independently of file order. Lead and error section remain unchanged; archive lists retain their previous default. The Videojuegos N button includes games through ?juegos=1; explicit cat=videojuegos also includes them. Counts now mean rendered cards out of matching list entries, after removing entries already shown above in the default view.
- Pure app/utils/filters.ts owns query parsing, filtering, sorting and facet derivation. useDealFilters retains reactive URL wiring and the after-mount guard. Default sorting preserves file order; readable and legacy tipo links still work.
- max= is an inclusive ceiling. Suggested buckets (25/50/100/250/500/1000) require a supported-currency offer below and above the limit. USD/EUR/GBP are compared in their own units; other currencies remain visible. The control explains this. Zero is a valid shared ceiling; malformed, negative and infinite values are ignored.
- nuevas=1 means no history. Price, freshness, direct-link, flag and minimum-discount options appear only when they narrow the applicable set. Facets respect other selections and ignore their own selection. Active controls remain available to clear; reset clears juegos/max/nuevas too. Pagination resets for the new keys. tienda/cat/min/q/orden/directas/vista remain shareable.
- DealCard and DealRow show directo beside direct actions, or a linked vía <source> beside indirect actions. DealMeta suppresses the moved credit, keeping one attribution per card. Hostnames remain screen-reader text. No new remote icons or network calls.
- /errores adds tienda alongside category and suspicion level; store/category counts respect one another. A three-hour refresh note follows its lede. Home empty state, API copy and ApiTeaser also say every three hours.
- Existing scoped styles and tokens retained; filter fields shrink and action markers wrap. Edited files use CRLF. No pipeline, contract, dependency or generated-data source files were edited; no commit was made.

### Verified

- npm test: 13 files, 218 tests passed (exit 0), including 8 new UI filter tests. The first sandbox attempt failed before tests because esbuild could not read ancestor directories; the permitted elevated retry passed.
- npx nuxt typecheck: exit 0. Additional npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json: exit 0. npm run typecheck:lib: exit 0.
- npx nuxt generate: exit 0; 10 routes prerendered, no EBUSY. Warnings concern Nuxt external cache-driver resolution and unused h3 imports.
- Read .output/public/index.html and mapped each card rank back to the input deal: 60 cards, zero videojuegos. Games chip: Videojuegos 100; count: 60 de 299 (lead excluded). JSON-LD parses and retains WebSite plus ItemList with 10 offers. No itemXml or descriptionHtml in home HTML.
- rg search for 11:00, 23:00 and dos veces al día in app: no matches.

### Not verified

- Browser interaction, live hydration and phone-width overflow measurement: verification was attempted, but the browser tool reports no available browsers. Responsive wrapping was reviewed in source only.
- Live /errores store/category interaction with real candidates, animations, and the concurrently revised pipeline output. Tests use synthetic deals and the build uses the current checked-in data.

## 2026-11-02: v3 front end (evidence first, serious filtering, table view)

The owner read the site as unserious. The home page now leads with price evidence, the default list is direct links with games off, and the deal list is a filterable table. Design contract in `docs/V3-DESIGN.md`.

### What changed

- **Removed:** `LeadDeal`, `DealRow`, `DealMeta`, `DealPrice` (and its count-down), `ErrorCard`, `ErrorWatch`, `DealList`. Nothing in `app/` imports `motion-v` any more; it is still in `package.json` for the operator to drop.
- **`toView()`** stays the one place for defaults. `normalizeReference()` in `utils/deal.ts` gives a v1/v2 row with a list price a `list` reference, because that is what a list price is. No list price means no reference. An unknown `kind` counts as the weakest. `direct` comes from the file when present, else the old heuristic. `normalizeGate()` drops a malformed gate.
- **Evidence is drawn three ways**, so it survives without colour: the row's left rule (3px solid, 1px solid, 1px dashed), the reference's underline (thick accent, thin, dashed and muted), the depth figure's weight (bold accent, semibold, regular muted). The classes are global in `main.css`: `ref--*`, `evi--*`, `depth--*`.
- **Strength tiers:** `fuerte` = ledger, cross-store. `media` = curated, source-previous. `debil` = list. `ninguna` = no reference. `byEvidence()` sorts by tier, then `errorScore`, so a seller's claim at 69 never sits above an observed price at 45.
- **Fixed wording:** a `list` reference always reads "Precio de lista del vendedor, sin verificar", whatever the file says. A `source-previous` reference always reads "Precio anterior según <quien lo reporta>".
- **Home:** smaller masthead, `EvidenceBoard` (top 6 candidates at `errorScore >= 40`, or one calm line), `DealExplorer`, `GateReport`, a smaller `ApiTeaser`.
- **`DealExplorer`:** search, sort and view above the results. `FilterPanel` is one DOM node: sticky side panel above 1100px, drawer below (`useDrawer`: focus in, Tab kept inside, Escape closes, focus returns, scroll locked). The drawer applies filters live; "Aplicar · ver N" closes it. There is no staged draft, so the counts are always true.
- **`DealTable`:** sticky header, sort buttons inside `th` with `aria-sort`. Age is sorted by publication time, so newest first reports as ascending age. Columns with nothing behind them (brand and interest on old archives) drop out. A container query folds brand, store and age under the title below 900px, and folds rows into blocks below 620px.
- **`HistoryMark` is a range with a tick, not a sparkline.** `history` carries only `minPrice`, `maxPrice` and `days`, so a line would invent points. It renders nothing when there is no range.
- **`/errores`:** grouped under strength headings, every signal on its own line, the cancellation and heuristic note at the top. `?min=` keeps its old meaning on this page; `?evidencia=` is new.
- **`GateReport`:** `gateSummary()` takes `publication-cap` out of `rejected` and out of the reason list. Those offers passed the filter and the list was full, so they get their own line. Today the pipeline adds capped rows to `rejected` and also to `low-value` (`scripts/pipeline.ts`); when it moves to the new slug, this copy is already right.
- **Grid card:** shows only "Posible error de precio", not "Baratísimo", which sat on most cards and said nothing.

### Query keys

Old keys still work: `tipo`, `tienda`, `cat`, `min`, `q`, `orden`, `directas`, `juegos`, `max`, `nuevas`, `vista` (`lista` now means the table).

New keys: `marca` (repeated), `tienda` (repeated), `desde`, `evidencia` (repeated), `interes`, `error`, `intermediarios`, `elegida`, `corroborada`, `dir`.

On the home page `min` means depth against the reference, with the declared discount as the fallback. `tipo` is accepted and removable but no longer offered.

### Verified

- `npx nuxt typecheck`: exit 0. `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`: clean.
- `npx nuxt generate`: exit 0 on the real v3 `public/api/deals.json`, 10 routes. See the build-dir note below.
- Vitest with a scratch config: 37 tests pass, `tests/ui-filters.test.ts` (8, unchanged) and `app/utils/filters.test.ts` (29, new). The repo's `include` is `tests/**`, so the new file does not run under `npm test` until it is moved or the include grows.
- Headless Chrome over CDP with real viewport emulation, on served copies, screenshots read:
  - Fixture with candidates: paper at 1440px and 390px, night at 1440px.
  - Fixture with no candidates: paper at 1440px, night at 390px.
  - 1120px and 900px widths; grid at 1440px and 390px; `/errores` at both widths; the real v3 build at both widths.
  - v1 archive (2026-10-05): screenshot at 1440px, no `NaN` or `undefined`, no brand or interest column; no gate block and no overflow at 390px.
  - v2 archive (2026-10-20): 60 rows at 1440px; no `NaN` or `undefined` and no overflow at 390px.
- Driven through the DOM on those copies:
  - Default list: direct only, no games. Facets, multi-store, counts following other selections, column sort both ways, `aria-sort`, removing one active filter, "Quitar todo", the middleman toggle and back.
  - Reload from a shared URL restores checkboxes and sort. Old keys restore too.
  - Enter on a focused header sorts. The drawer's count, Escape, focus return and apply action.
  - No horizontal overflow at 390px, 900px, 1120px or 1440px. Sticky header at `top: 0` for every column.
- No console errors or uncaught exceptions in any scenario. Production Vue does not report hydration mismatches there, so this does not rule one out.

### Not verified

- A real phone. 390px was emulated.
- Tab order walked key by key. The Tab trap in the drawer was not exercised; Enter and Escape were.
- Phone at night with candidates. Night at 390px was seen with none.
- Night has no reader-facing switch. It was checked by setting `data-variant` by hand, as there is no toggle or `prefers-color-scheme` rule.
- The final ranking. The operator is changing it, so the order on screen was not judged.
- `ledger` and `curated` rows on real candidates. Real data had one candidate, `source-previous`. The other kinds were seen on the fixture only.
- Link previews for the changed title and description.

### Worth knowing

- **Build dir.** With a `.nuxt` already present, `nuxt generate` builds under `node_modules/.cache/nuxt/.nuxt`. In this worktree that path crosses the junction, the server bundle gets `C:/…` imports, and every route fails with "Received protocol 'c:'". Delete `.nuxt` first, then generate. CI has no junction and is not affected.
- **Techbargains images fail.** The URL tested returned 403 to curl and the same images failed to load in Chrome, so those rows show no picture in the table and the store domain in the grid. CamelCamelCamel rows carry no image at all. Not worked around.

## 2026-11-04: bilingual, Formship, money switches, carousels, .si, errors context, layout shift

Owner brief: interesting, cohesive, monetizable, owned by Formship LLC, bilingual, better SEO and AI SEO, fix the feel. Front end only; the pipeline agent wrote `highlights.json`, `oracle.json`, `errors.json` `recent`/`nearest` and their types in `lib/types.ts` in the same session.

### What changed

- **English, no library.** `app/i18n/es.ts` is the source dictionary and `en.ts` is typed against it (`Dict`), so a missing key is a type error. `utils/locale.ts` holds the pure path map: Spanish at `/`, English at `/en`, `/en/errores`, `/en/si`, `/en/archivo`, `/en/api` and `/en/privacy`. `useLang()` reads the language from the path, so server and client always agree. English routes are `definePageMeta({ alias })` on the same page components, and `nitro.prerender.routes` lists all 12. Formatters and labels in `utils/format.ts`, `utils/deal.ts` and `utils/filters.ts` take an optional last `loc` argument that defaults to `'es'`, so the existing tests and callers read exactly as before. English reference notes are rebuilt from `kind`/`observations` (the pipeline writes them in Spanish). Pipeline-authored lines (error signals, the model note) stay Spanish on the English site, carry `lang="es"`, and get one line saying so. Deal titles stay as sourced. Flags in English: "Possible price error", "Dirt cheap".
- **Language switch.** A mono `EN` / `ES` at the end of the nav. It is a plain `<a>`, not a NuxtLink: `/en` is an alias of the same route record, and Vue Router treats a push from `/` to `/en` as a duplicate and stays put. This was observed in the browser, and NuxtLink also marked the link `aria-current="page"`.
- **The callout** (`LangCallout.vue`). It shows only on the Spanish site, only after mount, and only when `navigator.languages` has no `es*`. It is one line, absolutely positioned under the wordmark (no layout shift), and its text is "barato = cheap, in Spanish. barato.si = cheap as f***, yes. Read it in English →". Dismissal is remembered in `localStorage` (`barato.lang-callout`), and following the link also dismisses it.
- **Formship LLC.** In the footer: "barato.si es un proyecto de / barato.si is a project of [mark] Formship LLC", linking to formship.io. `FormshipMark.vue` is the Formship icon's two paths, copied exactly from `Formship-Site/public/brand/formship-icon-blue.svg` and drawn in `currentColor` with the base at 45% opacity, muted. Organization JSON-LD (`@id https://formship.io/#org`) is the WebSite's `publisher`. The "El dominio barato.si está en venta" line is gone. "Hecho por Chris D'Albano" stays. There is a new `/privacidad` and `/en/privacy` page: no accounts, Mouseflow analytics (already on the site), AdSense cookies *when ads are on*, affiliate tag *when on*, the one localStorage flag, and contact through formship.io. The page avoids specifics it cannot verify (for example, what Mouseflow masks).
- **Money switches.** These are `runtimeConfig.public` values in `nuxt.config.ts`. Each renders nothing when empty. See the table below.
  - `AdSlot.vue` loads only when `adsenseClient` matches `ca-pub-\d+` and the slot id is numeric. The script is added in `app.vue`'s head only then. There are at most two units: `stream` (a full-width labelled row after the 12th row of the home table or grid, and only on home) and `footer` (above the footer). Each is labelled "Publicidad"/"Ad" with a reserved `min-height` (120px / 100px).
  - `utils/affiliate.ts` + `useOutbound()`: with `amazonTag` set, only `https://(www.)amazon.com/dp/<10-char ASIN>` links with no `tag`/`ascsubtag`/`linkCode`/`linkId`/`camp`/`creative`/`creativeASIN`/`ref_` parameter get `?tag=`. Those links get `rel="sponsored nofollow noopener"`. No other link is touched, and someone else's tag is never replaced. The one-line FTC disclosure appears in the footer only when a tag is set. The JSON-LD keeps the plain link. Today 2 of the first 3 Amazon store URLs are canonical `/dp/` and the third (`/gp/product/…`) would be left alone.
  - `supportUrl` defaults to the Formship LLC Stripe Payment Link (lead, 2026-11-04), so the quiet "Apoya barato.si / Support barato.si" footer link is live. `sponsorUrl` adds "Patrocina barato.si / Sponsor barato.si" when set.
- **Carousels and lore** (`HighlightRows`, `PromoCarousel`, `PromoPrice`, `LoreCard`). There is one scroll-snap row per `highlights.json` slot, in the slot's language, between the error board and the table.
  - Behaviour: prev/next buttons (disabled at the ends), a focusable track so arrow keys scroll it, no autoplay, `smooth` only without `prefers-reduced-motion`, and lazy images in fixed-ratio frames, so the row height is known at first paint.
  - Data handling: slots whose ids are not in today's `deals.json` are skipped, and with no file or no slots nothing renders.
  - Don Centavo, the house tightwad, is a fictional narrator with seven "reglas de la casa". A rule card sits after the third card in rows with more than three deals, and the rule rotates with the date (the same on server and client). The first row ends with the intro card: "Don Centavo no existe. Sus reglas sí, y este índice las cumple." The rules are opinions in brand voice, with no numbers or claims about the world. He also signs a line on `/si` and in the `/errores` empty state.
- **`/si`** (`pages/si.vue`): "barato.si — .si de superinteligencia (experimental)".
  - Explainer: four numbered plain-language steps (empirical-Bayes beta-binomial on the ledger; horizon and drop threshold read from the file) and the caveat that this is not buying advice.
  - Scorecard: with resolved predictions it shows Brier vs. baseline and calibration buckets (predicted range, count, observed rate as a bar with the bucket midpoint tick). Before any prediction resolves it says honestly that the model is learning, since the ledger began in November 2026.
  - Verdict list: "espera" first, then "compra"; "aprendiendo" is only counted. Today all 102 predictions are `aprendiendo`, so the page says so instead of "no predictions".
  - Outbound links come from a small id→link map built from `deals.json`, so the page payload stays small.
  - The "¿espera o compra?" badge (`OracleBadge`) shows on grid cards, table rows, carousel cards and error rows when a non-learning prediction exists for that deal id. The page provides the map through `provideOracle()`, and with no provider there is no badge. Nav gains ".si".
- **`/errores` is never a dead end.** The threshold stays at 40. With nothing at 40+ today the page shows, in order:
  1. The honest empty state.
  2. "Errores recientes" from `recent` (each row dated "Visto el 3 nov").
  3. "Lo más cerca hoy (no son errores)" from `nearest`. These rows get the kicker "Bajo el umbral" instead of "Sospechoso", dashed muted rules and no accent, and the section note says they are below the bar.
  4. A pointer to `errors.xml` and the front page.
- **Layout shift between tabs** (measured, see below).
  - Root cause 1 was the scrollbar appearing and disappearing: `/archivo` is shorter than the viewport, so `clientWidth` went 1897 → 1912 and the centred header moved 7.5px. `scrollbar-gutter: stable` alone did not hold in Chrome 156 here. `html` now has `overflow-y: scroll; overflow-x: hidden` (the gutter is kept as well), and `body` lost its `overflow-x: hidden`. Left on body, that would have made body a scroll container and broken the sticky table header and filter panel once html's overflow stopped being `visible`.
  - Root cause 2 was a visible footer being dragged down when the next page's content arrived (0.085 on `/archivo`, 0.26 on `/api`). `main` now has `min-height: 100dvh`, so the footer always starts below the fold.
  - Root cause 3 was the font swap: an `'Inter Fallback'` `@font-face` on local Arial with Inter's metric overrides sits in `--font-sans`.
  - Active nav items change colour and rule only, never weight. On phones the header is two fixed rows (wordmark, then a sideways-scrolling nav), the same on every page.
- **SEO.**
  - `usePageSeo(key, crumb?)` sets, per page and language: title, description, `og:title/description/url/locale/locale:alternate/image:alt`, `twitter:title/description`, a self canonical, and hreflang `es`/`en`/`x-default`.
  - The old global hreflang links in `nuxt.config.ts` were removed: they told every subpage that `/` was its Spanish alternate.
  - URLs carry the trailing slash GitHub Pages serves (`/errores/`, `/en/`), because the host 301s the slashless form.
  - Home JSON-LD: Organization (Formship LLC), WebSite (publisher, author, `inLanguage` es+en, and a SearchAction on `?q=`, which is a real search because the home list filters on it), and an ItemList of the first 10 default-list offers as `Offer` (name, url, image, price, priceCurrency, seller name only; no ratings or reviews). Subpages get a BreadcrumbList.
  - `<html lang>` follows the page.
  - The API page is fully bilingual (`endpointsFor`, `schemaFor`, `fetchExampleFor` in `utils/api.ts`) and says the pipeline's text fields are Spanish.

### Env vars (all `NUXT_PUBLIC_*`, read at `nuxt generate`; the workflow must pass them)

| Variable | Default | Effect when set |
| --- | --- | --- |
| `NUXT_PUBLIC_ADSENSE_CLIENT` | empty | AdSense script loads (needs `ca-pub-<digits>`). Nothing renders without it. |
| `NUXT_PUBLIC_ADSENSE_SLOT_STREAM` | empty | Ad unit after the 12th row of the home list (needs the client too). |
| `NUXT_PUBLIC_ADSENSE_SLOT_FOOTER` | empty | Ad unit above the footer (needs the client too). |
| `NUXT_PUBLIC_AMAZON_TAG` | empty | Associates tag on canonical untagged `amazon.com/dp/` links, plus the footer disclosure. |
| `NUXT_PUBLIC_SUPPORT_URL` | Formship Stripe link | Footer "Apoya barato.si". Must be `https://`. Set to an empty string to hide. |
| `NUXT_PUBLIC_SPONSOR_URL` | empty | Footer "Patrocina barato.si". Must be `https://`. |

`.github/workflows/pages.yml` is not front-end-owned and was not touched. It needs these as `env:` on the generate step once Christian has AdSense approval and an Associates tag.

### Verified

- `npx nuxt typecheck`: exit 0. `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`: exit 0.
- `npm test`: 16 files, 302 tests pass (the suite includes the pipeline agent's new tests). The existing UI filter tests pass unchanged with the locale parameter added.
- `app/utils/affiliate.test.ts` (new; `npm test` only includes `tests/**`, so it was run with a scratch config): 5 tests pass. They cover tagging only canonical `/dp/`, leaving existing `tag`/`ascsubtag`, `/gp/`, `.co.uk`, `http`, lookalike URLs and bad tags alone, `rel`, and the locale path map both ways.
- `npx nuxt generate` (after deleting `.nuxt`): exit 0. All 12 pages prerendered: `/`, `/errores`, `/si`, `/archivo`, `/api`, `/privacidad`, and `/en`, `/en/errores`, `/en/si`, `/en/archivo`, `/en/api`, `/en/privacy`.
- Generated HTML, read with a script:
  - every page has the right `lang`, title, one description, a self canonical, the three hreflang links and `og:url`;
  - home JSON-LD = Organization + WebSite + ItemList(10), and subpages carry a BreadcrumbList;
  - no "está en venta"; formship.io and the Stripe link are present; no googlesyndication; the callout is absent from server HTML;
  - home has "Para mirar hoy", two carousels and three lore cards;
  - `/en` has no "Ver en" and 60 "See at";
  - `/errores` has the empty state, "Lo más cerca hoy" with five "Bajo el umbral" rows, and no "Errores recientes" (today's `recent` is empty, which is correct);
  - `/si` has the all-learning message.
- Real Chrome 156, served copy of `.output/public` at 1912px, using a PerformanceObserver on `layout-shift`:
  - Before the fixes: Hoy → Errores → .si → Archivo → API gave footer shifts of 0.085 and 0.262, and `clientWidth` changed on `/archivo`.
  - After the fixes, across the same five tabs: header height 49px and identical nav x-positions on every page, `clientWidth` 1897 throughout, and total shift ≈ 0.001 (one sub-0.001 entry at first load, plus one marked `hadRecentInput`).
  - The EN switch goes `/` → `/en/` with `lang="en"`. English nav to `/en/errores`, `/en/si`, `/en/archivo`, `/en/api` and back to `/en` renders English titles and h1s.
  - Carousels: the 3-card row fits with both buttons disabled. The 12-card row scrolled 1080px on "next" and enabled "previous".
  - No console messages.
  - Screenshots of `/en`, `/si` and `/errores` were read.

### Not verified

- **The callout on screen.** This browser's languages include `es-ES`, so it correctly did not show, and it could not be forced before mount from the tool. Its absence from the prerendered HTML and its logic were checked; its look was not.
- **Ads and the affiliate tag live.** Both are unset. The gating, the tagging rule and the reserved heights were checked in code and tests, not with a real AdSense unit.
- **Oracle badges, the graded scorecard and the "recent" list with real entries.** Today's data has no non-learning prediction, no resolved prediction and an empty `recent`, and no fixture was rendered for them. Those paths are typechecked and reviewed in source only.
- Phone width and the night variant were not looked at in this pass. The header's two-row phone layout was reviewed in CSS only.
- Link previews for the new titles and descriptions.

### For the pipeline (not edited here)

- `public/sitemap.xml` (written by `scripts/outputs.ts`) lists only `/` and data files. It should list the 12 pages above with trailing slashes, with `xhtml:link` hreflang alternates if wanted.
- `public/robots.txt` is also pipeline-written (`Allow: /` for every agent, sitemap pointed). That already admits AI crawlers; no change needed.
- `public/llms.txt` could mention `/si`, `/en/` and `highlights.json` / `oracle.json`.

## 2026-11-04 (v4.1): logo, landing pages, IndexNow, share, sponsored slot

Branch `v4.1-logo-growth`, not merged. Lead brief: integrate logo concept 2 "Vectorial", plus growth that needs no third-party account.

### Logo

- **Sources** live in `brand/`: `mark.svg` (cropped to the drawing, viewBox 26 26 148 148), `lockup.svg` / `lockup-dark.svg` (from `_runs/logos-2026-11-04/v3/svg/geo-lockup-*.svg`, background rect removed), and the HTML compositions `icon.html` and `og.html`. `node scripts/brand.mjs` renders every PNG with headless Chrome (no dependency; `CHROME=` overrides the path): `public/og.png`, `public/og-en.png`, `public/apple-touch-icon.png` (180), `public/icon-512.png`, `public/icon-maskable-512.png` (mark at 52 %, so its farthest corner sits inside the 40 % safe circle). Nothing in the pipeline writes these files. There was no og script before; the old og.png was made by hand.
- **Favicon** `public/favicon.svg`: the mark on transparent. Ink `#111111` turns white under `prefers-color-scheme: dark` (a `<style>` inside the SVG); the cobalt circle stays. `site.webmanifest` lists the 512, the maskable 512, the 180 and the SVG, with theme and background `#f3f0e8`. `nuxt.config.ts` links the apple-touch-icon and the manifest.
- **The wordmark stays text.** The header is `<BrandMark>` (inline SVG, `currentColor` for the ink parts, `--brand-cobalt` for the accent circle, `aria-hidden`) next to "barato.si" as real text, now in the logo's face: Outfit Medium (SIL OFL 1.1). It is subset with fontTools to `a-z . , í`, giving a 2.4 KB `public/fonts/outfit-500-brand.woff2`, which is preloaded with `font-display: block`, so the wordmark never paints in a fallback face and never changes width. Only the wordmark uses it (`--font-brand`); the rest of the site stays Inter.
- **Accent.** The paper accent was already `#2947d7`, the logo's cobalt, so it did not change. Contrast on paper `#f3f0e8` is 6.2:1, AA for body text. A new token, `--brand-cobalt` (the same in both variants), colours the mark's circle, the header full stop and the masthead and footer dots. Night keeps orange as its UI accent, but the brand stays cobalt, as in the logo's own dark version. Cobalt on night `#111310` is about 2.6:1. That colour is only ever used for the logo and decoration, which WCAG exempts as logotypes, never for text.
- **Masthead.** "barato, sí" keeps its Inter 700 nameplate. The mark stands before it at cap height (0.72em, on the baseline), and the full stop is drawn as one of the mark's perfect circles (0.16em, cobalt). The footer sign-off uses the same circle. All sizes are fixed in em, so nothing shifts.
- **OG.** Paper background, the lockup, one line ("Las rebajas de hoy, con la evidencia a la vista." / "Today's deepest US discounts, with the evidence.") and a ruled footer. `useSeo` now sets `og:image` and `twitter:image` per language (`seo.ogImage`), so `/en/*` gets `og-en.png`. The global tags in `nuxt.config.ts` carry keys, so pages override them.
- **JSON-LD.** The publisher Organization is Formship LLC, and barato's logo is not Formship's, so it does not go in the Organization's `logo`. Instead the Organization carries `brand: { @type: Brand, name: barato.si, logo: icon-512.png }`, and the WebSite gets `image: icon-512.png` (`BRAND_LOGO` in `useSeo.ts`).

### Category and store pages

- **One rule, one module.** `lib/landing.ts` is used by the pipeline's sitemap, the prerender list in `nuxt.config.ts`, IndexNow and the app. A page exists for each of our categories and each store with at least one deal in today's `deals.json`. Store names are slugged to ASCII.
  - Spanish category slugs are the category values. English ones are words: `/en/category/electronics/`, `video-games`, `computers`, and so on.
  - Store slugs are the same in both languages. Store spellings that slug the same share a page.
- **Routes.** `pages/categoria/[slug].vue` (alias `/en/category/:slug`) and `pages/tienda/[slug].vue` (alias `/en/store/:slug`) both render `LandingPage.vue`:
  - an eyebrow crumb, the h1 "Electrónica, hoy", and a lede with the count and date;
  - the same `DealExplorer` over that slice, with games and middlemen shown (the visitor chose the slice);
  - "Otras categorías / tiendas con ofertas hoy" as internal links.
  - `useSeo()`, the new general form of `usePageSeo`, gives each page its title, description, self canonical, es/en/x-default hreflang and a BreadcrumbList. An ItemList of the first 20 rows of the page's own default list is added.
  - Today that is 9 categories + 13 stores = 44 pages.
- **Language switch.** `utils/locale.ts` maps the pairs both ways, so EN/ES works on these pages.
- **Links in only where the page was built.** Home and the landing pages call `provideLanding()`, and the rows call `useLandingLinks()`. The archive provides nothing, so old days show plain text.
  - In the table, the store cell and a category line under the title are links.
  - On grid cards, the who-line is.
  - In the filter panel, choosing one category or exactly one store adds "Página de X →".
- **Empty after a refresh.** If a client refresh empties a slice, the page says "Hoy no queda nada en esta página. No la rellenamos con ofertas viejas."

### Share

- `ShareDeal.vue` sits on table rows (last column), grid cards, carousel cards and evidence rows (the home board and `/errores`).
  - With a coarse pointer and `navigator.share`, it opens the system sheet.
  - Otherwise it opens a small menu: **WhatsApp** (first, bold), Telegram, X, copy link.
  - This deviates from "always prefer navigator.share" on purpose: desktop Chrome on Windows exposes it too, and that sheet has no WhatsApp, so fine pointers get the menu.
- The menu is `position: fixed` under the button, because carousel tracks scroll sideways and clip anything absolutely positioned. It closes on an outside click, on Escape (focus returns to the button), and on any scroll or resize.
- The shared URL is barato.si, never the merchant:
  - from evidence rows: `/errores/?ref=share#d-<id>`;
  - otherwise: the deal's category page (it lists every deal in the category), else its store page.
  - `?ref=share` is read by nothing.
- Rows carry stable ids `d-<pipeline id>` (`dealAnchor()`). On `/errores` each id is used once: a past candidate that is also today's nearest miss keeps the id on today's row.
- `DealExplorer` follows the hash after mount: it shows enough chunks to include the row, scrolls it to the centre and marks it (`.is-shared`, a cobalt rule). Two things made this harder than expected:
  - During hydration, `location.hash` and the router's hash both read empty. It also reads the navigation entry's URL (only when its path is the current one) and listens to `hashchange`.
  - The filter reset after mount would undo the expansion, so the hash stays pending until the first pointer or key event.

### Sponsored slot

- **The data.** `app/data/sponsor.json` is `{ active, label, text, url, until, image? }`, committed and shipped with `active: false`. `activeSponsor()` in `utils/sponsor.ts` shows the slot only when all of these hold:
  - `active` is `true`;
  - `label` and `text` are not empty (they are cut to 60 and 160 characters, on one line);
  - `url` is https;
  - `until` (YYYY-MM-DD, the last day shown) is on or after the build date.
  - `image` is used only if it is https.
  - The build date comes from `useState('build-date')`, so the server and hydration agree.
- **The slot.** `SponsorSlot.vue` is one dashed-ruled line under the error board on the home page: the label "PATROCINADO", the sponsor's name in bold, their text and an arrow. It links with `rel="sponsored noopener"` in a new tab, and every field renders as text.
- **The footer.** While no sponsor is live, the footer shows "¿Anunciar aquí?" / "Advertise here", linking to `runtimeConfig.public.sponsorUrl`, with this line: "10 USD por semana. Lo revisamos antes de publicarlo y, si no encaja, te devolvemos el dinero. Es un sitio pequeño y nuevo: no garantizamos tráfico."
  - The old "Patrocina barato.si" link is gone (`footer.sponsor` was removed).
  - `SPONSOR_URL_DEFAULT` in `nuxt.config.ts` is the lead's Stripe Payment Link: 10 USD for one week, and checkout collects the URL and one line of text. `NUXT_PUBLIC_SPONSOR_URL` overrides it, and `''` hides the line.

#### Turning a sponsor on (Christian)

1. A Stripe payment arrives with "Link to promote" and "Slot text". Check both. To decline, refund in Stripe.
2. Edit `app/data/sponsor.json`:
   - `"active": true`
   - `"label"`: the sponsor's name
   - `"text"`: their line, one line; edit it for length and honesty
   - `"url"`: their https link
   - `"until"`: the last day it shows (the paid day + 6 for one week)
   - `"from"` (optional, added 2026-11-05): the first day it shows, for a week booked in advance, e.g. `"from": "2026-11-23", "until": "2026-11-30"` for Black Friday week. The site is static, so it appears with the first build on or after `from` (builds run every three hours). Leave it out or `""` to show from the next build.
   - `"image"`: an https logo URL, or `null`
3. Commit and push to main. The push-triggered deploy shows it, and the three-hourly builds keep it until `until` passes. After that it disappears on its own and "¿Anunciar aquí?" comes back. Set `active` back to `false` when you tidy up.

### IndexNow

- The key is `29c0951cd3928e86c5f663696aa6765c`, in `public/29c0951cd3928e86c5f663696aa6765c.txt`. The file is static and committed; `scripts/outputs.ts` writes only its own named files and never touches it.
- `scripts/indexnow.ts` builds `{ host, key, keyLocation, urlList }` from the six daily pages (home, /errores and /si in both languages) plus every landing page of the day, and POSTs it to `https://api.indexnow.org/indexnow`. Today's payload is 50 URLs.
- A new `indexnow` job in `.github/workflows/pages.yml` runs it with `needs: deploy` and `continue-on-error: true`, on Node only (no `npm ci`). The script always exits 0 and logs the HTTP status.

### Verified

- `npm test`: 18 files, 315 tests. New:
  - `tests/landing.test.ts` (9): slugs, the landing set, paths, anchors, the sitemap with and without landing pages, the IndexNow payload and key file, locale pairs.
  - `tests/sponsor.test.ts` (4).
- `npm run typecheck:lib`, `npx nuxt typecheck` and `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`: exit 0.
- `npx nuxt generate` (after deleting `.nuxt`): 56 pages, the 12 from before plus 44 landing pages.
- A script read the generated HTML and found:
  - titles, descriptions, a self canonical, the three hreflang links and og:image per language;
  - BreadcrumbList + ItemList on landing pages;
  - `d-` ids and share buttons on rows, plus store and category links;
  - icons, manifest and font preload in the head.
- The pipeline's `sitemap()` on today's `deals.json` lists exactly the 44 built landing pages.
- In Chrome 156 on a served copy:
  - the home header and masthead render;
  - the share menu opens with WhatsApp first, and the share URL is `https://barato.si/categoria/electronica/?ref=share#d-…`;
  - a deep link to the 148th row of `/categoria/videojuegos/` expands the list to 148 and scrolls the row into view.

### Not verified

- A real IndexNow POST (the key file is not live until deploy), and the CI job itself.
- `navigator.share` on a real phone. The system-sheet path was reviewed in code only.
- `/errores` share and anchors with real rows: today's `errors.json` has no deals, no recent and no nearest.
- A live sponsor on the site. The gate has unit tests, but nothing was rendered with `active: true`.
- Link previews (Facebook, WhatsApp and X debuggers) for og.png and og-en.png.
- How Bing and Google treat thin store pages (several have 1 to 3 deals). The rule is "at least one deal"; raise it in `lib/landing.ts` if they underperform.

## 2026-11-04 (v4.2): return visits, the weekly page, the advertise page

Branch `v4.2-return-visits`, not merged.

- **`/semana` and `/en/week`** (`pages/semana.vue`, `useWeek()` in `useExtras.ts`, `normalizeWeek()` in `utils/extras.ts`): renders `week.json`; every sentence with a number comes from `lib/digest.ts` `weekCopy()`, the same function that writes `/semana.xml`. Drops, lows and re-scored errors with a fixed 56 px picture box (44 px on phones), the forecast lines, the rule of the week, "RSS de la semana". Pipeline evidence lines and classifier notes are Spanish and carry `lang="es"` on the English page. Missing file: one honest line. Nav gains "Semana" / "Week" between .si and Archivo; footer gains "RSS de la semana"; a global `alternate` link for semana.xml.
- **`/anunciate` and `/en/advertise`**: what the slot is (one labelled line under the error board, both languages, 7 days, 10 USD), review and full refund if declined, what we do not promise (no traffic or audience numbers, no guarantees), facts read at build from `deals.json` (deals today, sources that answered, pages per language = the 8 static pages + landing pages, landing count, cadence, last update), and the Stripe button (`runtimeConfig.public.sponsorUrl`). While a sponsor is live it says the space is taken until `until`; with `sponsorUrl` empty it says the space is not for sale. The footer's "¿Anunciar aquí?" now opens this page (shown whenever no sponsor is live) instead of Stripe.
- **Category/store pages**: a visible "RSS de esta categoría / tienda" link under the lede and a per-page `<link rel="alternate" type="application/rss+xml">` to `/feeds/…`.
- **Home "vuelve" line** (`NextRefresh.vue`, under the masthead strip): next slot = generatedAt floored to 3 h + 3 h (cron `0 */3 * * *`). Prerendered in UTC, switched to the reader's clock after mount, "va con retraso" once more than 60 min past due, plus a link to the week. One fixed-height line with ellipsis: measured CLS 0.0007 on home in Chrome.
- **`/si` countdown**: "Primeras notas el 19 nov: faltan 15 días." from `scorecard.firstDue` counted against the oracle file's own date (not the visitor's clock), shown only while nothing is graded.

### Verified
- `npm test` 19 files / 332 tests, `npm run typecheck:lib`, `npx nuxt typecheck`: exit 0. `npx nuxt generate` (clean `.nuxt`): 166 routes, incl. the four new pages; canonicals, `lang` and titles read from the HTML.
- Chrome on a local static server: `/semana/` (8 drops with pictures, honest empty errors, forecast lines, rule 4, no console errors); `/anunciate/` (facts 250 / 9 / 30 / 22, Stripe button, footer link -> /anunciate); `/categoria/electronica/` (RSS link -> feed 200, valid XML, 46 items = 46 deals on the page); home next-refresh line in local time.

### Not verified
- `/en/week` and `/en/advertise` were checked in generated HTML only, not on screen. Phone widths not looked at. The "late" state and a live sponsor on `/anunciate` were not rendered. Feed readers (real subscriptions) not tried.

## 2026-11-04: one intro line per category page (es + en)

- **Copy table.** `CATEGORY_INTRO` in `lib/landing.ts` (next to `CATEGORY_NAME_ES`): one dry sentence per category and language, naming the kind of products and the check. Every line says "comparados con un precio de referencia cuando lo hay" / "compared with a reference price when there is one", because not every row has a reference. Informática and Electrónica also say each price is checked for a possible price error. Games name Steam, GOG and Epic, which are real sources. No "chollo", no traffic, savings or "best deals" claims, nothing about stores we cannot back up. `categoryIntro(category, loc)` returns null for anything that is not one of our categories.
- **Page.** `LandingPage.vue` shows the line as a `lp__lede` paragraph above the count lede, on category pages only, and on empty days too (it describes the page, not today's rows). Stores and unknown slugs get nothing: no empty paragraph, the same page as before.
- **Meta description.** `landing.seoCatDesc(label, n, intro?)`: with deals and an intro, "N ofertas de X hoy en tiendas de EE. UU. {intro} Actualizado cada tres horas." Without an intro the text is unchanged, and the empty-day text ("Hoy no hay ofertas de X…") is unchanged either way.
- **Tests** (`tests/landing.test.ts`, 3 new): the table has exactly our 14 categories, each with a non-empty es and en line that is a single sentence of at most 170 characters with no hype words, and es differs from en; unknown values (`Electronics`, English slugs, `''`, null, `toString`, `__proto__`) give null in both languages, and a null or empty intro leaves the description unchanged; the intro sits after the count in the description and is left out on an empty day.

**Verified:** `npm --prefix barato test` 19 files / 349 tests passed; `npm --prefix barato run typecheck:lib` clean. **Not verified:** `npx nuxt typecheck`, `npx nuxt generate` and the rendered page in a browser were not run, so the new paragraph and the meta tag were not seen in generated HTML. All edited files kept CRLF (Edit tool only, no new files).

## 2026-11-05: deal-season guides (/guia/<slug>, /en/guide/<slug>)

- **Three explainers, es + en**, for November searches: `precio-antes-inflado` / `fake-was-price`, `por-que-cancelan-errores-de-precio` / `why-stores-cancel-price-errors`, `para-que-sirve-cyber-monday` / `what-cyber-monday-is-good-for`. Slugs are in `lib/guides.ts` (pure, so the pipeline's sitemap and the site's prerender list and hreflang read one set). Text is in `app/utils/guides.ts`. Short and dry, with no "chollo" and no em dashes. Examples are dated records from our own files: the Lenovo V14 G5 at Walmart (629 USD on 11-05; week.json lows show 28 prior days, low 629, high 859.99, and deals.json has a ledger median of 629) and the Targus DOCK215USZ (59.99 against CamelCamelCamel's 287.99, errors.json/week.json 11-05). The only external source is the FTC's 16 CFR Part 233 on eCFR. The text says what the guide says and calls it guidance, not a guarantee. Retailer terms are described in general ("suelen", "en varias") and nobody's terms are quoted.
- **Page** `app/pages/guia/[slug].vue` (alias `/en/guide/:slug`). Unknown slug → 404. Eyebrow and breadcrumb go back to /black-friday, followed by sections, sources, a hub link and the other two guides. JSON-LD: Article (headline, description, inLanguage, dateModified = `GUIDES_UPDATED`, publisher = Formship org @id) plus the usual BreadcrumbList via `useSeo`. Text is rendered as text, never `v-html`.
- **Routing.** `utils/locale.ts` maps `/guia/<es>` ↔ `/en/guide/<en>` in both directions. `nuxt.config.ts` prerenders all 6 routes. `scripts/outputs.ts` `sitemap()` adds them with es/en/x-default alternates. IndexNow is unchanged, because the guides aren't daily pages.
- **Hub.** /black-friday lists the three guides under "Cómo leer estos días".
- **Tests:** `tests/guides.test.ts` (6): slugs, path round-trip, sitemap alternates, per-language text checks (no chollo, no em dash, description 80-200 chars), list order, prerender and hub wiring. The fixed sitemap counts in `landing.test.ts` and `oracle.test.ts` went from 24/18 to 30/24.

**Verified:** `npm --prefix barato test` 20 files / 355 tests passed; `npm --prefix barato run typecheck:lib` clean. **Not verified:** `npx nuxt typecheck`, `npx nuxt generate` and the rendered page (not run in the shift), so the prerender of the 6 routes and the HTML/JSON-LD were not observed. Check the live `/guia/precio-antes-inflado/` and `/en/guide/fake-was-price/` after deploy. **Line endings:** the 4 new files (`lib/guides.ts`, `app/utils/guides.ts`, `app/pages/guia/[slug].vue`, `tests/guides.test.ts`) were written with LF, because the shift's tools can't write CR. Every edited file kept CRLF. Convert those four to CRLF.

## 2026-11-05 (later): CRLF on the guides, sponsor `from` date

- The four guide files are CRLF now (`python check_links.py --crlf`, run from the Formship repo). At 15:0x UTC the live site didn't have the guides yet: `/guia/precio-antes-inflado/` and `/en/guide/fake-was-price/` returned an HTTP error, and the live sitemap was from 10:41Z, before the guides commit. The next three-hourly build should publish them. Check again after that build.
- **Sponsor slot `from` (optional).** `activeSponsor()` now takes an optional `from` (YYYY-MM-DD, first day shown) in `app/data/sponsor.json`, so a Black Friday week booked early can be committed ahead of time (`from` 2026-11-23, `until` 2026-11-30). A `from` that is present but malformed, or later than `until`, means no slot, matching the gate's rule that anything malformed shows nothing. `sponsor.json` still ships with `active: false` and no `from`. The `Sponsor` return shape is unchanged. "Turning a sponsor on" documents the field. Known gap: `/anunciate` doesn't say a future week is taken, so during a booked-ahead week the Stripe button stays up until `from`, and a second buyer for the same week gets a refund.
- **Tests:** `tests/sponsor.test.ts` +1 (before/on/after a booked week, empty/null `from`, malformed and after-`until` `from`).

## 2026-11-05 (L1S7): /semana titles without the stale Techbargains price

- **What was wrong (live check, 15:3x UTC).** Techbargains titles end in the price on the day they were published. On /semana that read as a contradiction: "Bqevi ... Heated Socks $41.29" sat right above "de 41,29 US$ el 1 nov a 29,49 US$ el 2 nov", and "Poofzy ... $91.14" above a drop to 74,99. /anunciate was fine (no traffic numbers, stats read from the index).
- **Fix.** `weekTitle()` in `lib/digest.ts` removes only a bare trailing "$N" (with optional thousands and cents). It leaves the title unchanged when the price is part of the sentence ("for $1,549 in cart", "now $25", "to $5") or when removing it would leave the title empty. It's used for the three item links in `app/pages/semana.vue` and in `dropLine`/`lowLine`/`errorLine`, so the page and /semana.xml agree. Stored titles, ids and every other page are unchanged; the pipeline still keeps the source title as is.
- **Tests:** `tests/week-title.test.ts` (3): strips trailing prices, leaves 8 titles it must not touch unchanged, and the drop line no longer prints the stale price.

**Verified:** `npm --prefix barato test` 21 files / 359 passed; `npm --prefix barato run typecheck:lib` clean. **Not verified:** `npx nuxt typecheck` / `nuxt generate` (not run in the shift). Check the live /semana after the next build.
