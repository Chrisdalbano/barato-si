# Data pipeline implementation

Built a Node 22 daily collector using built-in fetch, pure TypeScript parsers, source normalizers, URL/title deduplication, conservative ranking, and static JSON/RSS/discovery outputs. No runtime dependencies were added. The existing app/ UI was not edited. package.json was changed only to add the explicitly requested deals command and a library type-check command.

## Run and verify

- npm run deals
- npm test
- npm run typecheck:lib
- npm run generate

On this Windows machine use npm.cmd if PowerShell blocks npm.ps1. Vitest needed execution outside the filesystem sandbox because esbuild could not read ancestor directories; no code workaround or policy change was needed. Static generation succeeded, with Nuxt's existing Windows file-URL external-import warnings.

## Live source audit ? 2026-10-05

All probes used the honest User-Agent: barato.si deals bot; +https://barato.si/llms.txt. Actual status/robots snapshots are in tests/fixtures/live-probes.json. A robots denial is a completed policy probe: the denied endpoint is deliberately NOT fetched. One feed data request per enabled source per run, plus robots.txt preflight cached per origin. No retries, automatic redirects, product-page requests, credentials or IP/UA workarounds. Each request has a 15-second deadline and 4 MB response cap. Robots failures/HTML/403/429/5xx fail closed; 404/410 means no policy file. Crawl-delay is honored. A dead source never aborts the collection.

| Source | Live finding | Deals in committed run |
| --- | --- | ---: |
| CheapShark | robots.txt disallows /api/1.0/. API not requested despite documented permission. | 0 |
| Slickdeals frontpage | RSS search path is disallowed. Legacy rss.php returned 301 to FeedBurner; FeedBurner robots returned HTML. Current terms also require written permission for automated access and redistribution. Disabled. | 0 |
| Slickdeals popular | Same robots/terms restriction; denied endpoint not requested. Disabled. | 0 |
| DealNews | Documented recent-deals RSS with sort=time returned 200 repeatedly. Bare ?rss=1 returned 406; electronics category RSS also returned 200. Main recent feed is enabled. 36 eligible single-product offers after dropping roundups, variable prices and conditional freebies. | 36 |
| Reddit r/deals | Live robots.txt disallows /. No JSON/RSS fetched. | 0 |
| Reddit r/buildapcsales | Same shared-origin robots denial. | 0 |
| Reddit r/GameDeals | Same shared-origin robots denial. | 0 |
| Woot | Legacy /blog/feed.rss returned 404. Official developer API requires x-api-key; no open authenticated substitute attempted. api.woot.com robots returned 403. Disabled. | 0 |
| eBay | Legacy deals RSS /rps/feed/v1.1/epn/feed.xml returned 404. No open replacement verified; no product pages fetched. Disabled. | 0 |
| Epic | freeGamesPromotions returned 200. Saved a real fixture and tested active/future/expired promotion windows, but public syndication permission for this undocumented endpoint was not verified. Disabled. | 0 |
| Steam | featuredcategories returned 200 (three-item real fixture saved). Its storefront API is undocumented; public syndication permission was not verified. Disabled. | 0 |

Permission references:

- [CheapShark API documentation](https://apidocs.cheapshark.com/): public API, honest UA, use the CheapShark redirect URL for every deal; avoid bulk catalog collection. Robots currently prevents enabling it under this job's stricter rule.
- [DealNews RSS terms](https://www.dealnews.com/pages/rss.html): permits public feeds with DealNews attribution, unchanged content and links/referral codes, and excludes public browser extensions. The collector keeps original item XML and descriptions and leaves outgoing URLs unchanged. Canonicalization is used only for IDs/deduplication.
- [Slickdeals terms](https://slickdeals.net/content/list/slickdeals-terms-of-service/): automated access and copying/displaying offers elsewhere require written permission. [Syndication API](https://corp-site.slickdeals.net/api-sales/) requires onboarding.
- [Woot official API documentation](https://developer.woot.com/): x-api-key required.
- [Reddit public content/robots announcement](https://redditinc.com/news/robot-txt-update): access restrictions; the live robots result takes precedence here.

Public accessibility does not establish redistribution permission. Steam/Epic remain disabled rather than claiming their successful probes authorize publication. To enable a dormant source, verify its current documentation/terms and robots policy, update scripts/sources.ts with that evidence, and add a current permitted fixture. CheapShark/Reddit will still be robots-checked each run; sources excluded for terms/authentication are not contacted by the scheduled collector.

## Contract and UI usage

All three required names and signatures remain exported from lib/index.ts. Two backward-compatible optional Deal fields were added: sourceSignal (actual feed vote/thumb/rating evidence, not product review count), and syndication (attribution, feedUrl, itemXml, descriptionHtml). The latter preserves original publisher content so the normalized API and RSS do not discard it. Existing required fields were not changed.

```ts
import type { DealsFile } from './lib/index'
import { parsePrices, scoreDeal, dedupe } from './lib/index'

const response = await fetch('/api/deals.json')
if (!response.ok) throw new Error('No se pudieron cargar las ofertas')
const file: DealsFile = await response.json()
const offers = file.deals // already ranked and deduplicated
const lastUpdated = file.generatedAt
const unavailable = file.sources.filter(source => !source.ok)
// In a hypothetical user-controlled filter:
const bargains = offers.filter(deal => deal.flag !== 'normal')
```

UI handoff: show the original title and original offer URL, source attribution/link, currency, and update time. DealNews feed display must preserve original syndicated content and referral links; syndication carries it. Display barato.si's score/reasons separately as independent analysis, without presenting them as DealNews text. Never inject untrusted descriptionHtml/itemXml directly into the app with v-html; use an appropriately isolated/safe feed renderer. Do not translate or rewrite publisher titles. API/RSS/discovery copy and ranking reasons are Spanish; original publisher content retains its language. This task cannot verify the separate designer's eventual rendering; the feed-display requirements are part of this handoff.

## Ranking, parsing and retention

Score: discount depth (up to 60 points), logarithmic absolute savings (up to 20), exponentially decaying publication freshness (up to 12), and logarithmic source signal (up to 8). Timestamps in the future cannot earn extra freshness. Missing publication times use the first observation and are preserved on later runs. USD/EUR/GBP receive capped nominal savings points; no exchange-rate claims are made. Other currencies receive no absolute-savings points or magnitude-based error flags.

Probable errors require explicit, non-negated/non-question source-title language, or an actual discount of at least 85% with a reference above 40 in USD/EUR/GBP. Routine game sales, giveaways, clothing/shoes, and clearance are excluded from the numeric error heuristic. This is intentionally stricter than simply labeling every large discount an error. Unknown list prices remain null; advertised percentages alone do not invent list prices. Missing sale prices are dropped rather than turned into zero. Roundups, starting-price ranges, shipping thresholds, coupon amounts and conditional freebies are filtered conservatively. Structured feed prices override rounded editorial title prices.

Dedupe retains the highest-ranked offer for a canonical URL, or near-identical title with matching model/capacity numbers, price and currency. Canonicalization removes known tracking parameters but retains identity parameters such as dealID. IDs use a browser-compatible 64-bit FNV-1a hash of the canonical URL. Original links are never rewritten. It may miss duplicates with different prices or merchant wording rather than incorrectly merging different products.

Output: public/api/deals.json (top 150), public/api/deals/YYYY-MM-DD.json, public/api/index.json (latest is a YYYY-MM-DD date; days is newest first), public/feed.xml (top 30; original DealNews items retained), public/llms.txt, public/robots.txt and public/sitemap.xml. Archives retain today plus 29 previous UTC calendar days; older date-named archives are deleted. First-seen dates survive gaps using retained archives; offers unseen beyond the retention window may get a new foundAt. Source counts are valid normalized offers before cross-source deduplication/capping. All-source failure publishes an empty current file with explicit failures, never stale offers disguised as fresh ones. Files are written with temporary-file renames.

## Automation

.github/workflows/pages.yml runs on main pushes, daily at 11:00 UTC, and workflow_dispatch. It uses npm ci, deals, tests, library type-check and Nuxt generation; commits only generated public data with [skip ci]; then uploads/deploys .output/public with official GitHub Pages actions. The repository must allow GITHUB_TOKEN contents writes, allow direct refresh commits to main, and have Pages configured for GitHub Actions. Concurrent runs are serialized; a competing human push can reject the data push safely (no force push). Cron execution can be delayed by GitHub. No deployment, remote creation or push was performed locally.

## Validation and known limits

Final checks: all 78 Vitest tests passed; npm run typecheck:lib passed; npm run generate produced .output/public successfully; generated RSS and sitemap parsed as XML, with 30 RSS items. git diff --check passed.

Vitest covers prices (USD/EUR/GBP, locale separators, ambiguous/free/shipping/coupon cases), ranking boundaries and corrupt numeric inputs, dedupe, robots specificity/wildcards/denials, per-source failures, real fixture normalization, expired/future offers, archive deletion and caps. Steam/Epic fixtures are offline adapter tests only. For blocked/authenticated sources it would violate the task to obtain a successful real deal response: their real failure/robots fixtures are replayed and synthetic adapter cases are explicitly labelled. The collector does not fall back to fixture offers.

Only one approved live source is currently retained, so today's coverage is not internet-wide. DealNews's first RSS page is intentionally not paginated. Deals can expire between daily runs; US availability, coupon/Prime requirements, shipping and tax are not verified at retailers. List prices are publisher assertions, not independently audited historical prices. A strong discount does not prove a merchant made a mistake. The lightweight RSS reader is scoped to these publisher RSS/Atom item shapes, rejects entity/doctype declarations, and does not fetch external resources; it is not a general-purpose XML processor.

## Today's top five

Generated 2026-10-05T21:38:00.198Z; 36 offers. Titles below are the unchanged publisher titles. All prices are USD.

| Rank | Offer | Price | List | Discount | Score | Flag |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | [Alfani Men's Short-Sleeve Solid Textured Shirt for $7 + free shipping w/ $39](https://www.dealnews.com/Alfani-Mens-Short-Sleeve-Solid-Textured-Shirt-for-7-free-shipping-w-39/22246961.html?iref=rss) | 7.46 | 50.00 | 85.08% | 74 | chollo |
| 2 | [adidas Men's Samoa Shoes for $29 + free shipping](https://www.dealnews.com/adidas-Mens-Samoa-Shoes-for-29-free-shipping/22246856.html?iref=rss) | 29.00 | 80.00 | 63.75% | 62 | chollo |
| 3 | [adidas Men's Run 70s 2.0 Shoes for $26 + free shipping](https://www.dealnews.com/adidas-Mens-Run-70-s-2-0-Shoes-for-26-free-shipping/22246844.html?iref=rss) | 26.00 | 70.00 | 62.86% | 61 | chollo |
| 4 | [Amazon Ember 4-Series 55" 4K UHD HDR10+ Smart TV for $280 w/ Prime + free shipping](https://www.dealnews.com/Amazon-Ember-4-Series-55-4-K-UHD-HDR10-Smart-TV-for-280-w-Prime-free-shipping/22246918.html?iref=rss) | 280.00 | 460.00 | 39.13% | 51 | chollo |
| 5 | [Keurig K-Duo Single Serve & Carafe Coffee Maker for $130 + free shipping](https://www.dealnews.com/Keurig-K-Duo-Single-Serve-Carafe-Coffee-Maker-for-130-free-shipping/22246938.html?iref=rss) | 130.00 | 219.99 | 40.91% | 50 | chollo |
