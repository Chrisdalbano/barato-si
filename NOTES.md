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
