# barato.si data pipeline v2

Node 22, TypeScript, built-in fetch, and no added runtime dependencies. The owner's `lib/types.ts` is the unchanged contract. Normalization, categorization, ranking, deduplication, and classification validation are DOM-free. `scripts/fetch-deals.mjs` is only the Node launcher; orchestration is TypeScript. This work does not edit or include the concurrent `app/` or Nuxt configuration changes. No push or deployment was performed.

## Run and verify

`npm run deals`, `npm test`, and `npm run typecheck:lib` (use `npm.cmd` in Windows PowerShell). The final real collection and validation results appear below. Vitest/esbuild requires filesystem access outside this Windows sandbox to read ancestor directories. Tests use fixtures or mocked fetch and timers; they do not call live providers. The Nuxt build is outside this pipeline task.

## Collection and permissions

All sources start through `Promise.allSettled`. Each source fetches its pages serially and commits only complete normalized pages to its result. A failed later page preserves earlier valid pages, marks the source failed, and publishes a Spanish explanation. A stalled source has a 45-second deadline, requests have a 20-second timeout, and collection plus optional classification share a four-minute budget. Abort signals propagate into fetch, queued work, delays, and model calls; even a reader ignoring cancellation cannot mutate the published result later.

The network scheduler serializes each origin and permits at most six requests overall. Publisher robots checks remain mandatory; a missing robots file (404/410) permits access, other unavailable/invalid policies fail closed. Crawl-delay is honored conservatively; DealNews has a two-second minimum. `requests` counts actual data endpoint attempts, including retries, excluding robots checks; `ms` includes waiting and robots checks. First-party JSON requests alone get one retry with jitter for 5xx/timeouts. RSS and aggregator requests never retry. Redirects are refused; responses are capped at 4 MB, including streamed bodies without Content-Length.

The honest User-Agent remains exactly `barato.si deals bot; +https://barato.si/llms.txt`. The owner-approved robots exceptions are pinned by source kind, HTTPS origin, and exact path, with exactly five entries: Steam `/api/featuredcategories` and `/search/results/`, `catalog.gog.com/v1/catalog`, CheapShark `/api/1.0/deals`, and Epic's existing `/freeGamesPromotions` endpoint. No Amazon, eBay, Walmart, or other retailer product pages are scraped. No UA disguise or disallow bypass was introduced.

### Source behavior

- Steam: three 100-row search pages plus featured categories. Regex parsing reads each row's title, capsule, final cents, and original price; links omit tracking queries. Featured expiration validation remains. Canonical Steam IDs ignore slug/tracking differences.
- GOG: three 100-product pages. The live schema uses `price.finalMoney.amount` and `baseMoney.amount` as decimal-unit strings with currency codes; display prices are not parsed. Prefer `storeLink`, otherwise the supplied slug. Preserve cover images; formatter placeholders normalize to `_product_tile_304`. A real returned cover resolved with HTTP 200 on October 6.
- Epic: unchanged active free-game windows, real zero promotional price, and first-party links/images.
- CheapShark: three 60-item pages. Preserve its required redirect URL, use the checked-in store map and merchant domains, and expose a Steam `storeUrl` only for Steam-store rows with a numeric app ID.
- DealNews: recent deals, Electronics, Computers, and Home-Garden RSS. Preserve original links, images, retailer/category fields, attribution, item XML, and HTML. Structured prices take priority. Main JSON retains only syndication attribution and links; raw content moves to the daily raw file. Original syndicated items remain intact in the main RSS. [RSS terms](https://www.dealnews.com/pages/rss.html).
- Techbargains: one RSS 0.91 feed, 600 source items on the live check. Item links already point to merchants and become both `url` and `storeUrl`. Hostnames determine retailer identity. Prices/reference prices come from titles, images from descriptions, attribution from a Techbargains GUID or homepage. Roundups, ranges, and unknown prices are dropped; no merchant page is fetched.
- Best Buy: dormant without `BESTBUY_API_KEY`; documented Products API, up to 100 discounted products. The key is added to the query only inside transport, never to the configured URL or output. Synthetic fixture covers its product schema.
- Woot: dormant without `WOOT_API_KEY`; [official documentation](https://developer.woot.com/) confirms `/feed/All?page=1`, 100 items per page, and the `x-api-key` header. Reject sold-out, expired, and variant-price ranges. Synthetic fixture follows the documented schema; no authenticated live request was made.
- IsThereAnyDeal: existing optional deals-v2 adapter, dormant without `ITAD_API_KEY`; keep documented `ITAD-API-Key` header, affiliate links, expiration checks, and currency consistency. Optional APIs keep robots preflight and are not extra exceptions. No optional retailer/API key was configured in the local live run.

Images normalize protocol-relative URLs to HTTPS and reject non-HTTPS URLs. Missing images remain null, never invented. Categorization uses a table of product keywords and publisher category labels; game sources/stores remain videojuegos. Product keywords take priority over broad labels such as Electronics. Normalized Spanish categories remain authoritative.

### Rejected sources

The following October 6 findings were supplied by the owner from live probes with the honest UA; they were not re-probed or worked around in this implementation:

| Source | Evidence and decision |
| --- | --- |
| Humble store API | HTTP 403; robots forbids bots. Excluded. |
| Fanatical | HTTP 403, "Request blocked". Excluded. |
| Reddit JSON | HTTP 403 and robots disallow. Excluded. |
| itch.io sales RSS | Empty channel. No usable offers. |
| Slickdeals RSS | HTTP 200, but the owner declines reliance on its aggregator terms. Excluded. |
| Ben's Bargains | Only 20 items with affiliate wrappers; low incremental value. |
| 9to5Toys | Blog posts instead of direct structured offers; low value. |
| Newegg RSS | HTTP 301 to HTML. Not a feed. |
| Woot RSS | HTTP 404; the authenticated Developer API is the optional replacement. |
| Best Buy RSS | HTTP 404; the authenticated Products API is the optional replacement. |
| Micro Center | HTTP 403 from Cloudflare. Excluded. |

## Independent price-error engine

`lib/rank.ts` preserves the deal-quality formula: discount up to 60 points, comparable-currency absolute savings up to 20, freshness up to 12, and source signal up to 8. The existing Baratísimo conditions remain. `lib/errors.ts` separately produces integer `errorScore` (0–100) and Spanish `errorSignals`, ordered by rule strength, including demotions. A probable error requires at least 70; candidates for review require at least 40. These are heuristics, not calibrated probabilities or confirmation.

For USD/EUR/GBP with list price above 40, discounts of 85/90/95 percent contribute 55/65/75. List prices of at least 300 add 10, and at least 1000 add another 10. High-ticket electronics/computer categories or matching title terms, list at least 200 and discount at least 70 percent, add 15. Affirmative sentence-level price-error evidence in the title or source text adds 35; negation, questions, corrections, and expired statements suppress that evidence.

Clearance, refurbished, used, open-box, renewed, pre-owned, or certified terms subtract 30. Coupon/code/subscription terms subtract 15. Games and software cap at 15; clothing, beauty, and food cap at 40. Free items and roundup/model-noise offers score zero. Model error at confidence >= 0.7 adds 20 and its note; deep subtracts 10; normal at >= 0.8 subtracts 20. Noise at >= 0.7 forces a Normal flag and the conditional-offer reason. Category/free/stability ceilings apply after model adjustments.

History comes from unique previous UTC archive dates, not today's rerun or duplicate current/archive copies. Each known ID gets `{ days, minPrice, maxPrice, firstSeen }`. Today's price below 40 percent of the archived minimum adds 10. At least two prior observations with both archived extremes within 2 percent subtract 25. This is conservative when prices varied: aggregate extrema must both match. `days` counts observed dates, so gaps are not independent evidence of continuous availability.

**Scoring conflict resolved explicitly:** the requested $99/$1,199 laptop scores 100; subtracting 25 alone leaves 75, contradicting the required stable-three-day example. To satisfy that example, stable prices also cap at 69, after the specified subtraction. This conservative interpretation was surfaced during implementation. The test verifies the new laptop scores 100 with three signals and the stable laptop is not a probable error. Evidence text retains the requested Spanish history wording; it summarizes recorded days rather than proving uninterrupted availability.

## Optional classifier

Enable by obtaining an OpenRouter free key and adding repository secret `LLM_API_KEY`; the workflow maps it into the deals step. Without a key there are no provider requests, no `ai` fields created, and `DealsFile.classifier` is omitted; the CLI reports that classification is not configured. Deterministic scoring always runs.

Configuration: `LLM_BASE_URL` defaults to `https://openrouter.ai/api/v1`; `LLM_MODEL` defaults to `google/gemma-4-26b-a4b-it:free`; `LLM_FALLBACK_MODELS` defaults to `nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-31b-it:free`. The model IDs were supplied by the owner as verified today. Any HTTPS OpenAI-compatible chat-completions provider can be configured. Workflow maps `LLM_MODEL` from secrets; base URL/fallback overrides can be set in the process environment. Requests include the required HTTP-Referer and X-Title attribution headers, temperature zero, and JSON-object response format.

Only non-game candidates are considered: errorScore >= 30, or discount >= 60 percent with list >= 100, or explicit error evidence. Maximum 150 candidates, 25 per batch, eight total provider attempts including fallbacks, 45 seconds per attempt within the run deadline. 429/5xx and invalid output try the next configured model; non-retryable HTTP failures discard the batch. Model input is limited to specified product fields and 300 description characters, with untrusted-data instructions.

Every returned batch must contain exactly the known IDs once each, valid category/verdict enums, finite numeric confidence in [0,1], and product/note strings. HTML and URLs are removed; product is capped at 200 characters, note at 160. Any invalid row discards the entire batch. The prompt requires a Spanish note. Valid results remain in `ai`; deterministic category and scoring rules retain their independent evidence. `classifier` reports model, success, classified/cached counts, and only a generic Spanish failure message.

`data/classify-cache.json` is keyed by ID and stores price, date, and validated verdict. A changed price triggers a new classification; records older than 30 days or malformed records are removed. A different day's unchanged price can reuse the verdict. Secrets come only from environment variables. Transport diagnostics, protected API responses echoing credentials, and model output containing the key are never published or logged.

## Dedupe, outputs, and limits

Existing canonical-link and conservative title/model/price matching remain. Steam app IDs unify search, featured, and CheapShark. GOG uses actual catalog slugs; CheapShark GOG titles resolve against unambiguous exact catalog titles without guessing URLs. For these identities, prefer direct offers within 2 percent, otherwise the cheaper offer. Equal model product names also dedupe when currency matches and prices are within 2 percent. Missing images/store links inherit from the dropped offer. Inputs are not mutated.

The main list has at most 400 items, with 15 non-game and 15 game offers alternating in the first 30 when available, followed by the existing score order. This preserves the requested editorial rule; deep game discounts can dominate the remaining 370 slots. Source counts describe all normalized offers before dedupe/capping.

- `public/api/deals.json` and `public/api/deals/YYYY-MM-DD.json`: compact version-2 payload, enforced maximum 700,000 bytes before replacing current output.
- `public/api/errors.json` and `public/errors.xml`: every deduplicated candidate at errorScore >= 40, including candidates outside the main 400, descending errorScore. Empty output is legitimate.
- `public/api/raw/YYYY-MM-DD.json`: original syndication XML/HTML keyed by ID, including collected syndicated offers outside the main 400.
- `public/api/index.json`: unchanged `{ latest, days }` contract.
- `public/feed.xml`, `public/llms.txt`, `public/robots.txt`, `public/sitemap.xml`: discovery, attribution, and Spanish feed descriptions; both new error endpoints are listed.

Daily deal/raw archives retain today plus 29 prior UTC days. Existing v1 archives are read with missing-field defaults (`errorScore: 0`, `errorSignals: []`, `storeUrl/storeDomain: null`) and preserve first-seen dates. All output documents are fully staged before atomic per-file renames, current JSON last; retention runs after publication. This is not a cross-file filesystem transaction. A total source outage publishes an honest empty current result with failures, not fixtures or stale data disguised as fresh. No raw HTML/XML should be rendered unsanitized.

The workflow runs at 11:00 and 23:00 UTC, with a 15-minute build-job timeout. It maps LLM, ITAD, Best Buy, and Woot secrets into the deals step and commits `data/`, generated APIs, and both RSS feeds. Its existing push/deploy behavior was not invoked locally.

## Blocked-from-CI sources and the local refresh (2026-10-06, owner)

techbargains.com sits behind Cloudflare and challenges GitHub's runner IPs (HTTP 403, `cf-mitigated: challenge`, verified from a workflow step), while the same request from the owner's PC gets HTTP 200. Two measures:

- **Carry-over** (`carryOver` in scripts/pipeline.ts): when a source fails with zero offers and the currently published deals.json is less than 14 hours old, its offers for that source are carried into this run, re-scored, and the outcome says so: `ok: true`, `reusedFrom: <generatedAt of the original fetch>`, Spanish `errorEs` "Ofertas reutilizadas de la actualización de las HH:MM UTC…", English `error` with the real failure. The age is measured from the original fetch, so carry-overs never chain past the window. Only the published 400 are available to carry, which is why the local run should come first.
- **Local run** (`scripts/local-refresh.ps1`, Windows scheduled tasks "barato.si refresh AM/PM" at 06:35 and 18:35 local): pull, `npm run deals`, commit `public/` + `data/classify-cache.json`, push. The push triggers the Pages workflow, whose own collection then carries Techbargains over. Log at `data/local-refresh.log` (ignored). If the PC is off, CI publishes without Techbargains and says so.

Also restored: `SourceOutcome.error` is the English diagnostic again (`errorEs` stays generic Spanish); keyed sources still publish a fixed string. `balanceRanking` now interleaves games and other offers through the whole 400-item list (a pure score sort had published 385 games).

## Live run and validation

Generated 2026-10-06T23:07:17.594Z by a real npm run deals run. All six configured sources succeeded. 1443 normalized offers across 16 data requests; 400 published after dedupe and the 400-item cap. Classifier: not configured (no local key); classifier field omitted. All 400/400 published items have HTTPS images. Main JSON: 326,107 bytes, below 700 KB. The balanced first 30 contain 15 games and 15 other offers.

| Source | Direct? | Requests | Live outcome | Offers before dedupe |
| --- | --- | ---: | --- | ---: |
| CheapShark | No | 3 | HTTP 200; all pages completed (398 ms) | 180 |
| Steam | Yes | 4 | HTTP 200; all pages completed (1600 ms) | 308 |
| Epic | Yes | 1 | HTTP 200; all pages completed (394 ms) | 2 |
| DealNews | No | 4 | HTTP 200; all pages completed (8362 ms) | 147 |
| GOG | Yes | 3 | HTTP 200; all pages completed (2160 ms) | 300 |
| Techbargains | No | 1 | HTTP 200; all pages completed (390 ms) | 506 |
| Best Buy | Yes | 0 | Dormant; no key, not contacted | 0 |
| Woot | Yes | 0 | Dormant; no key, not contacted | 0 |
| IsThereAnyDeal | No | 0 | Dormant; no key, not contacted | 0 |

Published category counts:

| Category | Offers |
| --- | ---: |
| videojuegos | 385 |
| informatica | 0 |
| electronica | 4 |
| hogar | 2 |
| cocina | 5 |
| herramientas | 0 |
| ropa | 0 |
| deporte | 0 |
| juguetes | 0 |
| belleza | 0 |
| alimentacion | 0 |
| software | 1 |
| otros | 3 |

Across all deduplicated collected offers, errorScore >= 40: **0**; errorScore >= 70: **0**. Both error outputs are valid and empty. The threshold was not lowered to populate them.

Top eight published offers by errorScore (these are not probable errors):

| Offer | Store | Error score | Evidence, strongest first |
| --- | --- | ---: | --- |
| [Blink Wired Doorbell 2K+ & Outdoor 2K+ 5-Camera Security System for $120 + free shipping](https://www.dealnews.com/Blink-Wired-Doorbell-2-K-Outdoor-2-K-5-Camera-Security-System-for-120-free-shipping/22250058.html?iref=rss) | Amazon | 25 | Electrónica cara con rebaja fuera de lo normal; Artículo de precio alto (lista 400,00 USD) |
| [Sony Z9K Series XR75Z9K 75" 8K HDR Mini LED UHD Smart TV for $1,498 + free shipping](https://www.dealnews.com/products/Sony-Electronics/Sony-Z9-K-Series-XR75-Z9-K-75-8-K-HDR-Mini-LED-UHD-Smart-TV/541141.html?iref=rss-c142) | Amazon | 20 | Artículo de precio alto (lista 3498,00 USD) |
| [EF EcoFlow Delta 3 Classic 1024Wh Portable Solar Generator w/ 220W Solar Panel for $659 w/ Prime + free shipping](https://www.dealnews.com/EF-Eco-Flow-Delta-3-Classic-1024-Wh-Portable-Solar-Generator-w-220-W-Solar-Panel-for-659-w-Prime-free-shipping/22249986.html?iref=rss-c142) | Amazon | 20 | Artículo de precio alto (lista 1099,00 USD) |
| [Suncast Tremont 8x10-Foot Resin Outdoor Storage Shed for $1,033 w/ Prime + free shipping](https://www.dealnews.com/products/Suncast/Suncast-Tremont-8-x10-Foot-Resin-Outdoor-Storage-Shed/541152.html?iref=rss-c196) | Amazon | 20 | Artículo de precio alto (lista 1650,00 USD) |
| [Whale Rock All Games Bundle](https://www.gog.com/en/game/whale_rock_all_games_bundle) | GOG | 15 | Cuesta el 5 % del precio de lista; Rebaja habitual en videojuegos o software |
| [Whale Rock Games - Immersive Puzzles Bundle](https://www.gog.com/en/game/whale_rock_games_immersive_puzzles_bundle) | GOG | 15 | Cuesta el 5 % del precio de lista; Rebaja habitual en videojuegos o software |
| [Watch_Dogs® 2](https://store.steampowered.com/app/447040/Watch_Dogs_2/) | Steam | 15 | Cuesta el 5 % del precio de lista; Rebaja habitual en videojuegos o software |
| [Suicide Squad: Kill the Justice League - Digital Deluxe Edition](https://www.cheapshark.com/redirect?dealID=U2ne5odE6WKyoSROQN8D2OX2aRN8CJrxoFxZ%2BktLaHg%3D) | IndieGala | 15 | Cuesta el 4 % del precio de lista; Rebaja habitual en videojuegos o software |

Final verification: npm test **196 passed across 12 files**; npm run typecheck:lib **passed**; npm run deals **succeeded with real data**. Tests cover all active/optional adapters, category tables, separate error scoring and the stable laptop, malformed model batches and fallbacks, caching/caps, credential non-disclosure, source/run/request deadlines, host serialization, concurrency, cross-source dedupe, v1 history, raw/error outputs, pruning, and oversized-output protection.

## 2026-10-14: CI outage, lockfile ownership, and the hunt-first order (owner + Fable)

**What broke.** Both scheduled runs on 2026-10-14 (15:38 and 15:49 UTC) died in the install step with `npm error Cannot read properties of null (reading 'edgesOut')`. The workflow deleted `package-lock.json` and ran `npm install`, so every run re-resolved the whole tree. `@vitejs/devtools` 0.8.0 (published 08:09 UTC that day; an optional peer of `@nuxt/devtools`, which nuxt depends on) makes npm 10.9's resolver crash in `#loadPeerSet`. Reproduced on the owner's PC from a bare `package.json`; bisected by installing each dependency alone (`nuxt@^4.4.7` fails, every other direct dependency resolves) and then `@nuxt/devtools@3.4.2` and `3.4.3` alone (both fail, because the peer resolves to 0.8.0). `"overrides": { "@vitejs/devtools": "0.7.6" }` in `package.json` resolves again. The package is not installed either way (optional peer); the override only steers resolution.

**Structural fix.** CI no longer resolves anything: `npm ci --no-audit --no-fund` from the committed lockfile. The lockfile was deleted in CI because npm writes only the current platform's native bindings when it builds a lockfile next to an existing `node_modules` (npm/cli#4828), and this one is made on Windows. A fresh `npm install --package-lock-only` would include every platform but was tried and rejected: with the override it produced an internally inconsistent tree (`cac@7.1.0` vs `^6.7`, `commander`), and without it the resolver crashes. So the lockfile stays the Windows one and `scripts/lockfile-platforms.mjs` (`npm run lock:platforms`) adds the linux-x64 glibc entries each parent already declares in its `optionalDependencies` (esbuild, rollup, rolldown, lightningcss and rollup's `@napi-rs/lzma`), placed where npm hoisted the Windows siblings and copying their license/engines. It is idempotent; the workflow runs `--check` first so a skipped step fails with instructions. Run it after any `npm install` that changes the lockfile. `actions/checkout` and `actions/setup-node` moved to v6 (the runner now forces Node 24 and warned about v4).

**Cadence.** The schedule is `0 */3 * * *` instead of 11:00/23:00 UTC: price errors are corrected within hours, and a twice-a-day index saw mostly what survived. The local Windows task still pushes at 06:35/18:35 local; carry-over (14 h) still covers the Techbargains gap. `llms.txt` now says every three hours and asks agents for one request per three hours.

**Editorial order.** `balanceRanking` now leads with price-error candidates (`errorScore >= 40`, strongest first, then score), then interleaves one game for every seven non-game offers (`GAMES_EVERY = 8`, was 4), so the 400-item cap holds about 50 games instead of 100. Games cap at 15 in `lib/errors.ts`, so no game can lead. Covered by `tests/pipeline.test.ts` (interleave counts, candidates first, 39 is not a candidate). The errors.json threshold is unchanged at 40.

**Verified on the owner's PC:** `npm ci` from the patched lockfile (642 packages), `npm test` (12 files, 209 tests before the UI pass), `npm run typecheck:lib`, `node scripts/lockfile-platforms.mjs --check`. **Verified in CI:** run 38631044979 on the fix commit built, collected, tested and deployed in 1m34s. The ranking change had not yet run live when this was written; the next scheduled run publishes it. The front-end counterpart (games hidden by default, new filters) is Astra's run documented in `UI-NOTES.md`.


## 2026-11-02: v3 pipeline, product ledger, interest gate and private watch

Implemented in lib/, scripts/, tests/, curated reference data and .gitignore; lib/types.ts is unchanged. No commits, pushes, dependency changes, frontend edits or manual public-data edits. The live collector regenerated its public outputs and data files. Edited source files use CRLF. The gate returns copies instead of mutating its input.

Identity recognizes Amazon/CCC ASINs, Best Buy SKUs, Shopify handles and Steam app IDs, with URL-ID fallback. Brand recognition uses a curated two-tier table and the first recognized brand in the title (before later component brands). A direct link must match the known merchant domain; aggregator URLs are never direct. Source corroboration survives deduplication.

The pure ledger merges every freshly collected non-game offer before dedupe/gating/capping; carried offers do not create fresh observations. It seeds from archives on first run, keeps one daily low per UTC day for 120 days, keeps currencies separate, and prunes the largest serialized entries oldest-first to fit 3,000,000 bytes. Persistence uses a temporary file and rename. A change to a Shopify handle’s cheapest configuration resets that handle’s series; a mismatched configuration cannot supply a ledger reference/history. Published history comes from the ledger, including products absent from prior published lists.

References resolve in this order: median of at least three previous observed days (today excluded), same-key or identical strong manufacturer-model token at another merchant in the same currency, dated curated evidence, source previous price, seller list. Shared GPU/CPU/capacity tokens are not strong model identities. Curated MSRP seeds are operator-supplied NVIDIA DGX Spark 128GB 6,950 USD (2026-10-02) and GB10 64GB 4,999 USD (2026-10-23), not independently verified manufacturer quotes. Two editorial conservative floors dated today: 200 USD for a complete new RTX 4060 laptop, 150 USD for a complete new RTX 4080 graphics card. Regex exclusions reject used/parts/accessories; explicit regex checks also rejected cooling pads, refurbished laptops and GPU fans; these are deliberately low screening floors, not measured market prices.

Error scoring retains thresholds 40/70 and existing refurb (-30), coupon (-15), stable-price (subtract 25 and cap 69), game/software (cap 15), roundup/noise/free (zero), category and classifier demotions. Reference depth supplies evidence without a list price. Source-previous depth weighs 0.8 and cross-store 0.9 versus ledger/curated 1.0. A noname list claim alone caps at 39. The first live pass incorrectly made a rug and a digital calendar with roughly 40% drops candidates; a regression now requires 60% reference depth before ordinary depth points begin (20 points at 60%, 45 at 70%, 55/65/75 at 85/90/95%). Curated-floor breaches have their own explicit 40-point signal. No threshold was lowered to fill the error list.

Interest awards 30/20 brand points, 25 technical-category or 10 durable-product points, 10 for unit value >=25 USD/EUR/GBP, 15 for a direct link, 15 for two sources and 15 for DealNews staffPick (cap 100). Normal offers need 45 interest and a 15-unit price floor; apparel/food/beauty/seasonal decor/gift cards and noname inflated-list offers are rejected. Non-game error candidates pass except roundups/noise; games remain eligible but rank last. Ordering is candidates first by error score, then directness, interest, deal score and stable ID. Publication caps at 250. Gate considered is post-dedupe; rejected includes the publication cap under low-value, so considered = published + rejected. Raw syndicated output retains admitted uncapped offers, and errors.json remains independent of the 250-row cap.

CamelCamelCamel parses the down-percent / to / from title form, validates arithmetic and ASIN, publishes the canonical Amazon link and preserves the CCC attribution/reference. Shopify uses available variants and each variant’s own compare_at_price, selecting the cheapest US variant when regional variants exist; an EU-only product is excluded. The exact selected configuration is visible in the title. Catalog endpoints are scoped to verified US-dollar storefronts: robots-checked /meta.json returned currency USD for Minisforum, GMKtec and AOOSTAR on 2026-11-02. No retailer HTML enters the public collector. Keepa is dormant without KEEPA_API_KEY; its documented /deal schema uses deals.dr and current[0] cents, excluding -1 unavailable values. No paid Keepa call was made. Fixture documentation: [Deal Object](https://keepa.com/api-docs/deal-object.html), [Browsing Deals](https://keepa.com/api-docs/deals.html). Keys are added only inside transport and never to published configuration; robots preflight carries no key. No robots exceptions were added.

Live merchant probes used the exact existing honest UA, manual redirects and robots-aware reader:

| Merchant | Probe result | Decision |
| --- | --- | --- |
| store.minisforum.com | robots allowed; products.json HTTP 200, 64 products | enabled |
| www.gmktec.com | robots allowed; HTTP 200, 66 products | enabled; first collection later returned 429, final collection recovered |
| aoostar.com | robots allowed; HTTP 200, 24 products | enabled |
| www.bee-link.com | robots passed, catalog HTTP 429 | excluded |
| acemagic.com | robots passed, catalog HTTP 429 | excluded |
| shop.canaan.io | robots.txt unavailable | excluded without catalog request |

Private watch: copy data/private/watchlist.example.json to watchlist.json; run node --experimental-strip-types scripts/watch.ts. Rules are {name,title,maxPrice?,urls?}, with title a regex. Local collection saves every fresh pre-gate offer into ignored data/private/collected.json; watch ignores snapshots older than 14h. Explicit HTTPS product URLs use the same robots-aware reader, parse only JSON-LD offers.price/currency/availability, and record blocked challenges/403s without bypass. First sighting, max-price match, >=5% drop and back-in-stock can fire; rises and blocked checks are retained too. Fires deduplicate by rule, currency and price. BARATO_BOARD_CMD is a literal executable path or JSON argv array, never a shell string; stdin receives one JSON line {title,body}. Unset prints. An exclusive local lock prevents concurrent watch runs. CI/GITHUB_ACTIONS abort before private reads or writes; watch never accesses public/. Local refresh calls it non-fatally after commit/push and stages only explicit generated data including the ledger; rebase conflict handling covers the ledger too. The example is trackable, all other private contents are ignored.

Integration boundary: package.json and .github/workflows/pages.yml were excluded by the task’s allowed-path list, so they remain untouched pending explicit permission. scripts/v3-wiring.patch contains the npm watch entry and explicit CI data-path staging change. The current workflow already stages data/, so it already includes data/price-ledger.json; the proposed narrowing makes this explicit. CI has no rebase path today; none was added. The local script does have rebase handling and was updated. Keepa requires the owner to provide its env key to a process (the existing workflow does not map a Keepa secret).

Final verification: npm test was attempted but this worktree lacks the other builder’s generated .nuxt/tsconfig.json. To stay within ownership, added tests/vitest.config.ts with inline TS transform options. npm test -- --config tests/vitest.config.ts passed **238 tests / 14 files**. npm run typecheck:lib passed. Windows sandbox esbuild ancestor access failed initially; the approved outside-sandbox test invocation succeeded. All unit tests use synthetic/mocked data; only merchant probes and the requested real npm run deals calls contacted providers. No Nuxt prepare/generate/typecheck, browser UI checks, real Desk command delivery, private live watch URL requests, scheduled-task execution, CI execution or authenticated Keepa calls were performed. The configured classifier failed and published a visible failure outcome; deterministic rules completed.

Final real npm run deals: **2026-11-02T19:32:04.300Z**. All ten enabled sources completed successfully; 1698 normalized offers, 23 endpoint requests. Published **250**, direct **246**. Ledger: 1258575 bytes, 5068 product series.

| Source | Offers | Requests | Outcome |
| --- | ---: | ---: | --- |
| CheapShark | 180 | 3 | success (643 ms) |
| Steam | 310 | 4 | success (927 ms) |
| Epic | 1 | 1 | success (187 ms) |
| DealNews | 198 | 7 | success (14458 ms) |
| GOG | 300 | 3 | success (1761 ms) |
| Techbargains | 587 | 1 | success (426 ms) |
| Minisforum | 59 | 1 | success (10652 ms) |
| GMKtec | 32 | 1 | success (556 ms) |
| AOOSTAR | 11 | 1 | success (571 ms) |
| CamelCamelCamel | 20 | 1 | success (2703 ms) |

Gate: {"considered":1606,"published":250,"rejected":1356,"byReason":{"noname-inflated":4,"low-value":1211,"apparel":46,"seasonal-decor":9,"food":69,"beauty":16,"gift-card":1}}. Zero middleman-duplicate rejections in this final run. low-value includes rows below the interest/price gate and rows outside the 250 publication cap.

References among published rows: ledger 69; cross-store 0; curated 0; source-previous 1; list 69; none 111.

Exact first 15 rows in publication order (all prices USD; references are evidence, not verified market values):

| # | Title | Store | Price | Reference | errorScore | Interest |
| ---: | --- | --- | ---: | --- | ---: | ---: |
| 1 | GMKtec G5S Intel® Celeron N5095 Mini PC — 8GB+128GB / US | GMKtec | 229.99 | list 399.99 | 10 | 80 |
| 2 | GMKtec G11 Plus AMD Ryzen™ 5 3500U Mini PC — Barebone (No DDR & SSD & OS） / US | GMKtec | 169.99 | list 299.99 | 0 | 80 |
| 3 | GMKtec K17 Plus Intel® Core™ Ultra 7 258V Mini PC — 32GB RAM+1TB SSD / US | GMKtec | 949.99 | list 1399.00 | 20 | 80 |
| 4 | GMKtec K13 Intel® Core™ Ultra 7 256V Mini PC — 16GB RAM+ 512GB SSD / US | GMKtec | 589.99 | list 899.99 | 10 | 80 |
| 5 | GMKtec EVO-T1 Intel® Core™ Ultra 9 285H AI Mini PC — Barebone (No DDR & SSD & OS） / US | GMKtec | 829.99 | list 1199.99 | 20 | 80 |
| 6 | GMKtec K16 AMD Ryzen™ 7 7735HS Mini PC — 32GB RAM+ 512GB SSD / US | GMKtec | 619.99 | list 899.99 | 10 | 80 |
| 7 | GMKtec M6 Ultra AMD Ryzen™ 5 7640HS Mini PC — Barebone (No DDR & SSD & OS） / US | GMKtec | 269.99 | list 399.99 | 10 | 80 |
| 8 | GMKtec M5S AMD Ryzen™ 3 5400U Mini PC — Barebone (No DDR & SSD & OS) / US | GMKtec | 269.99 | list 389.99 | 10 | 80 |
| 9 | MINISFORUM MS-S1 MAX 128GB Max AI Compute Edition — AMD Ryzen™ AI Max+ 395 / 128GB RAM + 2TB SSD \| Estimated shipping time: Early November / US | Minisforum | 3919.00 | list 4899.00 | 20 | 80 |
| 10 | MINISFORUM N5 MAX AI NAS — AMD Ryzen™ AI Max+ 395 / 64GB LPDDR5x + 128GB OS Storage / US | Minisforum | 2399.00 | list 2999.00 | 20 | 80 |
| 11 | MINISFORUM MS-S1 MAX 64GB Local AI Pilot Edition — AMD Ryzen™ AI Max+ 395 / 64GB RAM + 2TB SSD / US | Minisforum | 2599.00 | list 3249.00 | 20 | 80 |
| 12 | GMKtec M3S Intel® Core™ 3 304 Mini PC — 12GB RAM + 256GB SSD / US | GMKtec | 389.99 | list 519.99 | 10 | 80 |
| 13 | GMKtec NEO-X1 Pro AMD Ryzen™ 9 9955HX3D + NVIDIA® GeForce RTX™ 5070 MODT Gaming PC — AMD Ryzen™ 9 9955HX + NVIDIA® GeForce RTX™ 5060 Ti 8G / 32GB RAM + 1TB SSD / US | GMKtec | 2199.99 | list 2699.99 | 20 | 80 |
| 14 | MINISFORUM M2 Pro — Intel® Core™ Ultra X7 358H / 32GB RAM + 1TB SSD / US | Minisforum | 1439.00 | list 1799.00 | 20 | 80 |
| 15 | MINISFORUM AtomMan G1 Pro-89A6 — AMD Ryzen™ 9 8945HX / 32GB RAM+1TB SSD / US | Minisforum | 1759.00 | list 2199.00 | 20 | 80 |

Error-candidate list (>=40): **empty**. Probable errors (>=70): **0**. Hardware leads the final list; the rug/calendar false candidates are gone.

## 2026-11-02: operator tuning after the first v3 run

The first full run put 15 permanently discounted mini PCs on top, so ranking changed. A store's own catalog (`isCatalog`) now publishes only with 8%+ against its ledger or 35%+ off list (`catalog-price`). `rankValue` is half interest, half evidence, where a seller's list claim is worth 0.2-0.5 of an observed drop. `diversify` caps non-Amazon stores at 12 and breaks runs of three. New slugs: `replacement-part`, `variant-duplicate`, `publication-cap` (the cap no longer inflates `low-value`). CamelCamelCamel now reads daily and weekly feeds overall and for electronics, plus daily appliances; `bn=` values other than these came back empty or unfiltered. Spec floors widened to GPUs, gaming laptops, Mac Studio/MacBook Pro and 128GB AI Max+ 395 systems: editorial, dated, conservative, not measured. A breach scores 55, or 70 at 25% under. Classifier defaults moved to models that answered on 2026-11-02 (gemma free tier returned 429).

CamelCamelCamel's robots says `Content-Signal: search=yes,ai-train=no,use=reference`. Its rows are therefore linked and credited and kept out of the classifier, whose free models may log prompts. Its terms page gave no readable text: unverified. Techbargains images returned 403 to a plain request and do not load in Chrome; rows fall back to the store mark. A check using a browser user-agent and referrer was blocked by the harness and was against this project's rules; it must not be retried.

## 2026-11-02: pictures and price accuracy (owner report)

**Pictures.** A headless check had wrongly blamed Techbargains images; they load in a real browser. The blanks were CamelCamelCamel rows with no image, and feed thumbnails are 125px. Rows with an ASIN now use Amazon's own picture URL, with the feed image in `imageFallback`; `DealImage` steps down on failure or Amazon's 1x1 placeholder.

**Accuracy.** Owner reported prices that differ from the live page. Compared 32 Amazon rows in a real browser (`/dp/` page, displayed price, coupons not counted): 11 were 5%+ off, including the top suspect (Shark, listed $279.99, live $989.99 third-party). Age alone did not explain it. The seller did: of the Techbargains rows whose link was checked, 1 of 16 with `smid=ATVPDKIKX0DER` was wrong against 7 of 8 with another seller. So: `stale-price` gate (third-party or unmarked Amazon and CamelCamelCamel 24 h, sold by Amazon 96 h, DealNews 72 h, other merchants 48 h, catalogs live), weekly CamelCamelCamel feeds dropped, third-party Amazon ranks lower, and `scripts/verify.ts` checks up to 15 Amazon error candidates per run against their public CamelCamelCamel page before publishing (corrects, drops, or says "sin comprobar"). These cutoffs rest on a small sample. There is still no live price for ordinary rows without a Keepa or Creators API key, and the UI says to confirm at the store.

## 2026-11-04: the .si oracle, highlights, errors context, large-move signals, bilingual discovery

Pipeline paths only (lib/, scripts/, tests/). No app/, nuxt.config.ts, workflow or dependency changes; no commit. **Contract change, dated here as AGENTS.md requires:** lib/types.ts gains `ErrorsFile` (errors.json had no type; `deals` unchanged, plus optional `recent` and `nearest`), `HighlightSlot`, `HighlightsFile`, `OraclePrediction`, `OracleScorecard`, `OracleFile`. `DealsFile` and `Deal` are unchanged. New files: `public/api/oracle.json`, `public/api/highlights.json`, `data/oracle-log.json`.

### The .si oracle (lib/oracle.ts): "¿compra ahora o espera?"

The question, stated exactly: for a product our ledger tracks, at today's price p, what is the probability that a price we *observe* within the next 14 days is at least 5 % below p? Constants `HORIZON_DAYS = 14`, `DROP_THRESHOLD_PCT = 5`.

1. **Trials.** From each product's daily-low series, a window opens at an observed day t and covers (t, t+14]. It counts only when t+14 is before today (closed) and at least one later price was observed inside it; it is a success when the lowest of those later prices is at or below p(t) x 0.95 (cents rounded). The next window opens at the first observation after the previous one closed, so windows never overlap and one long-lived price is not counted as many trials. Product i gives (n_i windows, k_i successes).
2. **Prior, per category, by method of moments.** Pooled rate mu = sum k / sum n. Overdispersion between products gives the intra-class correlation rho = 1/(alpha+beta+1) from E[sum n_i (k_i/n_i - mu)^2] = mu(1-mu) [ (N-1) + rho ( sum(n_i-1) - sum n_i(n_i-1)/sum n_i ) ]. Strength alpha+beta = 1/rho - 1 is clamped to [2, 50] (never certain from the pool, never ignored); when every product has a single window rho is not identifiable and the strength is 10. mu is floored/capped to [0.02, 0.98] so both shape parameters stay positive. A category gets its own prior with at least 30 windows from 10 products; otherwise the global prior. Category of a ledger row is `categorize(title)`.
3. **Posterior.** Beta-binomial update with the product's own windows: pDrop = (alpha + k) / (alpha + beta + n), the posterior mean, rounded to 3 places.
4. **Verdict.** `aprendiendo` when the product has fewer than 2 own windows or the pool has fewer than 50 windows (then the prior is Beta(1,1) and `basis.category` is null); else `espera` if pDrop >= 0.5, `compra` otherwise. 0.5 is the decision that minimizes expected 0/1 loss: wait exactly when a 5 % drop is more likely than not. With a low base rate it takes repeated own drops to say `espera`, which is the right burden.
5. **Self-scoring.** Every run appends one entry per product per UTC day (the day's first run wins) to `data/oracle-log.json`: date, key, price, pDrop, verdict and `baseRate`, the pooled global rate known at that moment. When date+14 has passed, the entry resolves against the ledger: 1 dropped, 0 did not, `null` if nothing was observed in the window (excluded from scoring, never guessed). `scorecard` publishes the model's Brier score, the Brier of the naive predictor that always says `baseRate` (an out-of-sample baseline, not the realized rate), and calibration in 5 buckets [0,.2) ... [.8,1]. Log bounded to 180 days and 20,000 entries.

Predictions are published only for deals in deals.json with a productKey the ledger tracks in the same currency, so games (not in the ledger) get none. Sorted by pDrop, then own windows.

**Honest limits.** "Observed" means observed by us: the ledger was seeded from published archives (only days a product was published) and since 2026-11-02 holds every collected non-game offer; a gap is not a price. Outcomes are conditional on seeing the product again. Daily predictions of the same product are correlated, so the scorecard's n overstates independent evidence. The first resolutions arrive 2026-11-19; until then the scorecard is empty, and that is the result.

**First real fit (2026-11-04):** 987 products with a closed window (one each: the ledger spans 2026-10-05..11-04, so no product has two closed 14-day windows yet). Global rate 0.0446, default strength 10. Category priors: informatica 0.072, hogar 0.057, electronica 0.045, otros 0.039, cocina 0.016, deporte 0 (floored). 102 predictions, all `aprendiendo`.

### Highlights (lib/highlights.ts -> highlights.json)

Deterministic slots over the published 250; 3 to 12 ids each; a slot with fewer than 3 is omitted, never padded. Rules (stated in noteEs/noteEn): `caidas` at least 10 % below the last ledger price for the same product; `minimo-historico` at or below the lowest of at least 3 observed prior days in a series that moved 5 %+; `hardware-ia` GPU / mini PC / Mac Studio / Mac mini / NPU machines (accessories excluded) at least 10 % under any reference, ordered by `evidenceOf` so observed evidence outranks list claims; `menos-de-25` USD under 25 and at least 15 % under a non-list reference; `juegos` (one slot at most) list >= 20 and 80 %+ off. Today: `minimo-historico` 3, `juegos` 12. `caidas` and `hardware-ia` were empty because no published deal fell 10 % against its last observation and only two AI-hardware rows were 10 %+ under a reference; nothing was loosened.

### errors.json context (lib/error-feed.ts)

`recent`: candidates from the published day archives, last 30 days, before today, newest first, one per productKey+currency, excluding today's candidates. **Each archived row is re-scored by today's rules** (lib/rank.ts at its own day) and kept only at 40+; the published score/signals are the re-scored ones. Reason: the first pass returned 8 rows, all v2-era noname apparel multi-buys ("Pajama Pants 2 for $10"); today's engine scores every one of them 39 (the 2026-11-02 noname list-price cap retired exactly these). Showing them as past errors would repeat a retracted claim. Result today: `recent` 0. `nearest`: today's five highest non-game errorScores in (0, 40), a separate list the UI labels as closest, not errors (today 20, 20, 10, 10, 10). Threshold unchanged at 40.

### Large observed moves (lib/errors.ts, lib/interest.ts)

- **Break from a stable price**: with at least 3 prior observed days whose high is within 10 % of their low, a price 30 %+ below that low adds 15, 50 %+ adds 30 (`Rompe un precio estable: N % bajo el mínimo de D días observados`). A sudden fall through a flat price is the shape of a mistake; sales usually step down or were already moving. Worked: Lenovo laptop, 4 days at 1000-1050, today 480 -> 20 (reference 1000+) + 30 = 50, a candidate; at 650 -> 35, not one; same price after a 1000-1500 series -> 20. No threshold or cap changed; the noname, stable, category and game caps still apply after it.
- **Interest**: +10 `Nuevo mínimo frente a D días observados` when the price is 5 %+ under every one of at least 2 prior observed days.
- Neither fired on 2026-11-04's data. Not done: a separate cross-store spread signal when a ledger reference already exists (resolveReference still prefers the ledger).

### Discovery

sitemap.xml lists /, /errores, /archivo, /api, /si and their /en twins, each with es / en / x-default `xhtml:link` alternates, plus the four existing feed/JSON URLs. llms.txt documents errors.json `recent`/`nearest`, highlights.json and oracle.json, explains the oracle, adds an English section, and states barato.si is a Formship LLC project (https://formship.io). Feeds unchanged.

### Wiring

`scripts/run.ts` builds highlights and the oracle after collection (ledger including today), writes them in the same staged `writeOutputs` batch (new optional `extras` argument), then saves the ledger and `data/oracle-log.json` (`scripts/oracle-store.ts`, temp file + rename, 5 MB guard). `scripts/local-refresh.ps1` stages and conflict-resolves the log with the ledger. **Not applied:** the workflow stages explicit data files, so CI publishes oracle.json/highlights.json but does not commit the log; `scripts/oracle-wiring.patch` is the one-line change to `.github/workflows/pages.yml`.

### Verification

`npm test`: 16 files, 302 tests passed (23 new in tests/oracle.test.ts: windows, prior fitting and clamps, predictions, log resolution, Brier/baseline/buckets, highlight rules, recent re-scoring, nearest, the two new signals, outputs, sitemap). `npm run typecheck:lib` passed. Two real `npm run deals` runs on 2026-11-04 (27.6 s; all ten enabled sources succeeded, 250 published); the second confirmed the same-day log dedupe (102 entries, unchanged). Not verified: Nuxt build/typecheck, CI, the UI's use of the new files, any resolved prediction (none can resolve before 2026-11-19).

## 2026-11-04 (v4.1): landing pages in the sitemap, IndexNow

Pipeline code only (`lib/landing.ts` new, `scripts/outputs.ts`, `scripts/indexnow.ts` new, tests). No `lib/types.ts` change; no published file edited by hand.

- `sitemap(generatedAt, deals = [])` now also lists `/categoria/<slug>/`, `/en/category/<english slug>/`, `/tienda/<slug>/`, `/en/store/<slug>/` for every category and store with at least one deal in the published list, each with es/en/x-default alternates. `writeOutputs` passes `file.deals`. Slices with nothing today are not listed. The rule is `landingPages()` in `lib/landing.ts`, which the site's prerender list uses too, so the sitemap and the built pages are the same set (checked: 44 and 44 on 2026-11-04's data). `landingPairs()` is exported for tests.
- IndexNow: `scripts/indexnow.ts` (`buildPayload()` tested; `main()` never throws) runs in a new workflow job after deploy. The key file `public/<key>.txt` is static and committed; `writeOutputs` only renames its own named outputs, so it is never removed.
- Tests: `tests/landing.test.ts`. The sitemap test in `tests/oracle.test.ts` is unchanged and still passes (no deals = no landing URLs).

## 2026-11-04: classifier on Anthropic (owner)

The local refresh classifies with Claude Haiku (`LLM_BASE_URL=https://api.anthropic.com/v1`, `LLM_MODEL=claude-haiku-5-5`, fallback `claude-sonnet-5-5`) using the Formship LLC key, set as Windows user env vars. That key is org-level, so `LLM_WORKSPACE_ID` adds the `anthropic-workspace-id` header. Anthropic's OpenAI-compatible endpoint rejects `response_format: json_object` and `temperature` for current models, so both are sent only to other providers. Verified live: 3/3 classified. CI still has no key and applies cached verdicts.

## 2026-11-04 (v4.2): slice feeds, the weekly digest, oracle firstDue

Branch `v4.2-return-visits`. **Contract change, dated as AGENTS.md requires:** `lib/types.ts` gains `WeekDeal` and `WeekFile` (new file `public/api/week.json`), and `OracleScorecard` gains optional `firstDue` (first UTC day an open prediction can resolve: its date + horizon + 1; `resolveLog` closes an entry once date + horizon is before today). `DealsFile`, `Deal`, `ErrorsFile` and `HighlightsFile` are unchanged.

- **Slice feeds** (`scripts/outputs.ts` `sliceFeeds`/`sliceFeed`): `/feeds/categoria/<slug>.xml` for all 14 categories and `/feeds/tienda/<slug>.xml` for every store with deals today *or anywhere in the 30-day archive*, each with today's deals in that slice in editorial order (max 50; DealNews items keep their original XML, like feed.xml). A slice with nothing today gets a valid empty channel, so a subscriber sees "nothing today", never a 404 or yesterday's list. Files this run did not write are deleted. Same slice rule as `lib/landing.ts`. The RSS text is Spanish; English pages link the same file with `hreflang="es"`. `public/feeds/` and `public/semana.xml` are **gitignored**: every CI run regenerates them before `nuxt generate`, and committing 150+ churning files every 3 h is noise. `llms.txt` lists today's feeds under "Feeds de hoy".
- **La semana de Don Centavo** (`lib/digest.ts`, pure): window = the last 7 UTC days, today included, of published archives plus today's list (`run.ts`). `drops`: per product published in the window, the largest fall inside it against the previous observed ledger day, >= 10 % (the carousel's bar). `lows`: a published price at or below every one of >= 3 earlier observed days in a series that moved >= 5 % (the carousel's rule). `errors`: `recentCandidates()` over the window, i.e. re-scored by today's rules, one per product; `note` = the deal's `ai.note` or the cached classifier note. `forecast`: today's verdict counts, log entries made / resolved in the window, `firstDue`, and the oracle scorecard only once something resolved. `rule`: Don Centavo's rule n = ISO week mod 7 (rules moved to `lib/don-centavo.ts`, the dictionaries import them). The copy is templated in the same module (`weekCopy`, `weekText`, `*Detail`) in es and en, so `/semana.xml` and the page use the same sentences; short weeks (< 7 days) and quiet weeks (all three lists empty) say so. `/semana.xml` has one item per ISO week (guid `barato.si/semana/2026-W45`), refreshed every run.
- Sitemap: `semana/`, `en/week/`, `anunciate/`, `en/advertise/` pairs, plus `api/week.json` and `semana.xml`. IndexNow daily paths include `/semana/` and `/en/week/`.
- **First real run (2026-11-04 07:13 UTC, `npm run deals`):** 250 published, AOOSTAR HTTP 429; week 2026-W45: 7 days, 1281 products, 8 drops, 8 lows, 0 errors (no week candidate survives today's rules), 99 predictions all `aprendiendo`, 102 logged, firstDue 2026-11-19; 14 category + 143 store feeds. Those data files were **not** committed on the branch (pipeline-owned; CI regenerates them).
- Tests: `tests/digest.test.ts` (17): drops/lows/errors/forecast/rule, thin and quiet copy, graded copy, ISO weeks across year ends, the RSS item, slice feeds (empty, archive stores, cap, escaping), llms list, writeOutputs (week.json, semana.xml, feed pruning, sitemap), and the app's `normalizeWeek`. Sitemap counts in `tests/landing.test.ts` and `tests/oracle.test.ts` updated (8 page pairs, 6 files).
- **Workflow:** no change needed: `git add public/api` already commits week.json; the feeds deploy from the build.

## 2026-11-04: SEO pass on the category and store pages (front end)

App and tests only; no pipeline, `lib/types.ts`, published-data or dependency change. Titles, canonical and es/en/x-default hreflang on `/categoria`, `/tienda` and their `/en` twins were already right and unique per slice, so they were left alone. JSON-LD builders moved into `app/composables/useSeo.ts` as pure helpers (`offerListLd`, `breadcrumbLd`, `ldJson`), used by the home page, the slice pages and `useSeo()`'s BreadcrumbList with unchanged output, except that an Offer now drops `price`/`priceCurrency` or `seller` when the value is not real instead of printing `NaN` or an empty name. An empty slice still gets no ItemList. Meta descriptions for a slice with no deals now say so ("Hoy no hay ofertas de X…") instead of "0 ofertas". The home page lists today's category and store pages once, after the deal list, so every built slice page has a plain link from home. Tests added to `tests/landing.test.ts`. Verified by the shift: `npm test` 19 files / 338 tests passed, `npm run typecheck:lib` clean. Not run: `nuxt typecheck`, `nuxt generate`.
