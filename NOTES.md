# Data pipeline implementation

Node 22 daily collector using built-in fetch, TypeScript normalizers, URL/title deduplication, conservative ranking, and static JSON/RSS/discovery outputs. No runtime dependencies added. This follow-up does not edit or commit app/; another engineer owns those changes. No push or deployment.

## Run and verify

- npm run deals (npm.cmd on this Windows machine)
- npm test
- npm run typecheck:lib

Current validation: 126 tests pass; library type-check passes. Vitest requires execution outside the filesystem sandbox because esbuild cannot read ancestor directories. The full UI build was not run during concurrent app/ work.

## Owner-approved source expansion - 2026-10-05

The owner's override applies only to CheapShark deals, Steam featuredcategories, and Epic freeGamesPromotions. scripts/network.ts restricts the exception by source kind, exact HTTPS origin and exact endpoint path. These sources receive one data request each, without a robots preflight. Every other source retains the robots policy, including ITAD when configured. No retries, automatic redirects, retailer product-page scraping, UA disguises or pagination. Honest User-Agent: barato.si deals bot; +https://barato.si/llms.txt. Requests retain the 15-second deadline and 4 MB cap. Failures are isolated and reported with Spanish visitor messages.

| Product source | Live outcome | Normalized offers before dedupe |
| --- | --- | ---: |
| CheapShark | HTTP 200; active | 60 |
| Steam | HTTP 200; active | 10 |
| Epic | HTTP 200; active | 2 |
| DealNews | HTTP 200; active | 36 |

- CheapShark: documented deals endpoint, onSale=1, sortBy=Savings, pageSize=60. All links use the required CheapShark redirect URL, preserving dealID. Source is CheapShark; store is the actual merchant. The committed lib/cheapshark-stores.ts map was verified against the stores endpoint (HTTP 200) today; unknown store IDs are omitted instead of invented. Stores lookup is not an extra daily request. [API documentation](https://apidocs.cheapshark.com/).
- Steam: one official featuredcategories request, USD discounted specials only, reject expired discounts, official app/sub/bundle links. A discounted item with no explicit expiration is treated as currently active according to the live specials response.
- Epic: one freeGamesPromotions request; require a current start/end window, zero promotional discount setting, and an actual final price of zero. Upcoming and expired promotions are excluded. Links use the official product page.
- DealNews: recent-deals RSS, unchanged original content and referral links, source attribution retained. [RSS terms](https://www.dealnews.com/pages/rss.html).
- Reddit, Slickdeals, Woot and eBay are absent from configured sources and DealsFile.sources; no scheduled requests. Old adapter tests remain offline compatibility tests. Earlier disabled-source probe results remain in tests/fixtures/live-probes.json as historical evidence, not today's outcomes.

## Additional source investigation

Three candidates were checked live with the honest UA and the existing robots preflight. No candidate was silently promoted merely because its endpoint responded.

| Candidate | Endpoint / documentation | Live finding and decision |
| --- | --- | --- |
| itch.io | https://itch.io/feed/sales.xml; [official API overview](https://itch.io/docs/api/overview) explicitly publishes the active-sales RSS feed | Robots preflight passed; feed returned HTTP 429. No retry or workaround. Not enabled because no working live feed could be verified. |
| GOG | https://catalog.gog.com/v1/catalog?limit=48&order=desc:discount&discounted=eq:true&countryCode=US&currencyCode=USD | Robots preflight passed; catalogue returned HTTP 200 with discounted products, real prices, currency and official store links. Public catalogue syndication permission/documentation was not verified (official developer docs cover publisher integration; catalogue documentation found was unofficial). Not enabled under the unchanged reuse rule for additional sources. GOG deals already arrive through CheapShark with merchant attribution. |
| IsThereAnyDeal | https://api.isthereanydeal.com/deals/v2?country=US&limit=60&sort=-cut; [official API docs and terms](https://docs.isthereanydeal.com/) | Robots preflight passed; unauthenticated endpoint returned HTTP 403. Implemented behind optional ITAD_API_KEY, absent from product outcomes and never contacted by the daily collector without a key. No key was available for an authenticated live test. |

ITAD uses its documented header (ITAD-API-Key), never a query-string secret, and sends the key only on the data request, not robots. One page of up to 60 discounts; preserve provided affiliate URLs, store identity, prices/currency and timestamps; reject expired offers. Synthetic tests follow the documented v2 response schema. API terms permit public commercial applications but prohibit competing applications: the owner should ensure the registered use fits those terms before supplying a key. Set ITAD_API_KEY in the collector environment (and a workflow secret/environment mapping if enabling in CI); never commit it. No extra source qualifies for immediate live activation in this audit.

## Classification and Spanish wording

- Existing numeric probable-error rule is unchanged: at least 85% actual discount and reference above 40 USD/EUR/GBP, excluding game sales, clothing, giveaways and clearance. A price reduction alone is not proof of a mistake.
- Explicit evidence now examines both title and plain source description, with price error, price mistake, pricing error/mistake, glitch, mispriced and error de precio. Negated, questioned or corrected/expired statements are rejected per sentence. The preserved sourceText field makes description evidence reviewable.
- Game offers are never assigned error-probable, including a game literally titled Glitch. Free offers also never receive that flag and include the reason Gratis por tiempo limitado.
- Separate deep-discount signal: at least 75%, list price above 40 in comparable currencies, non-game/non-clothing/non-clearance. When it does not meet the stricter error rule, the existing internal bargain flag gets Descuento inusualmente profundo. Tests cover the 75%, 85%, list-price and category boundaries.
- The internal flag value remains compatible; generated reasons, feed.xml and llms.txt do not use the Spain-only word. The UI's display label is Baratísimo (UI work belongs to the other engineer). Original publisher titles and syndicated descriptions remain unchanged.

## Ranking and data contract

Score still combines discount depth (up to 60), nominal absolute savings (up to 20), freshness (up to 12), and source signal (up to 8). No currency-conversion claims. Dedupe selects the highest-ranked offer for canonical URL or closely matching title/model/price/currency; tracking removal affects identity only, never published links.

After dedupe, alternate the 15 highest-scoring non-game offers with the 15 highest-scoring game offers, starting with non-game. This category cap prevents multiple game sources collectively swamping the top 30 and makes the first eight mixed too. Within each category preserve score order; after those slots append remaining offers in score order. If a category is short, fill from remaining offers rather than hide inventory. Scores are unchanged, but the published list is intentionally not globally score-sorted. Today's top 30 has 15 game and 15 non-game offers. A single-source cap was not chosen because it would not constrain games spread across multiple sources.

All existing exports and required Deal fields remain compatible. Optional sourceText adds plain description evidence; sourceSignal remains real feed signal, not product review counts; syndication preserves DealNews attribution, feedUrl, itemXml and descriptionHtml. Source display names are now CheapShark, Steam, Epic and DealNews. Count per source is before cross-source dedupe/capping.

Keep DealNews content and referral links unchanged and attribution visible. Show barato.si analysis separately. Do not render untrusted syndication XML/HTML with v-html. Free is a real zero; unknown sale prices are dropped. Unknown reference prices stay null. Roundups, conditional freebies and ambiguous ranges are filtered. First-seen dates survive gaps through retained archives.

Outputs: public/api/deals.json (up to 150), daily public/api/deals/YYYY-MM-DD.json, public/api/index.json, feed.xml (top 30), llms.txt, robots.txt and sitemap.xml. Atomic renames; retain today plus 29 previous UTC days. Total source failure publishes empty current data with real failures, never fixtures or stale offers disguised as fresh.

## Automation and limitations

Existing .github/workflows/pages.yml runs daily at 11:00 UTC, on main pushes and workflow_dispatch; it collects, tests, type-checks and generates the Nuxt site, then commits generated public data and deploys using GitHub Pages actions. This local task did not trigger it. No dependencies, app/ files or workflow changes were needed.

Daily prices can expire; shipping, tax, region, coupons and membership requirements are not independently verified. Reference prices are publisher assertions, not audited historical lows. The RSS reader is scoped to publisher item shapes, rejects entity/doctype declarations, and does not fetch external entities. No Amazon or eBay product pages were scraped.

## Today's counts and top eight

Generated 2026-10-05T22:29:33.736Z: 107 unique offers after dedupe; 36 normal, 71 Baratísimo, 0 probable errors. 3 free offers. Empty probable-error results remain honest; the numeric threshold was not relaxed.

| Rank | Offer | Source / store | Price USD | List USD | Discount | Score | Display flag |
| ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | [Alfani Men's Short-Sleeve Solid Textured Shirt for $7 + free shipping w/ $39](https://www.dealnews.com/Alfani-Mens-Short-Sleeve-Solid-Textured-Shirt-for-7-free-shipping-w-39/22246961.html?iref=rss) | DealNews / Macy's | 7.46 | 50.00 | 85.08% | 74 | Baratísimo |
| 2 | [Great Houses of Calderia](https://www.cheapshark.com/redirect?dealID=ZfvFYzi5ySvyHATPHuaQ8Y1aisMpkqD23pGikPzYgfI%3D) | CheapShark / Gamesplanet | 1.12 | 24.99 | 95.52% | 82 | Baratísimo |
| 3 | [Amazon Ember 4-Series 55" 4K UHD HDR10+ Smart TV for $280 w/ Prime + free shipping](https://www.dealnews.com/Amazon-Ember-4-Series-55-4-K-UHD-HDR10-Smart-TV-for-280-w-Prime-free-shipping/22246918.html?iref=rss) | DealNews / Amazon | 280.00 | 460.00 | 39.13% | 51 | Baratísimo |
| 4 | [BURIED STARS](https://www.cheapshark.com/redirect?dealID=Ty418xbRKILwqDaZMoFbpL1rSNliHpS9PV7PRmWGO24%3D) | CheapShark / Epic Games Store | 0.00 | 39.99 | 100% | 81 | Baratísimo |
| 5 | [Keurig K-Duo Single Serve & Carafe Coffee Maker for $130 + free shipping](https://www.dealnews.com/Keurig-K-Duo-Single-Serve-Carafe-Coffee-Maker-for-130-free-shipping/22246938.html?iref=rss) | DealNews / Amazon | 130.00 | 219.99 | 40.91% | 50 | Baratísimo |
| 6 | [Suicide Squad: Kill the Justice League - Digital Deluxe Edition](https://www.cheapshark.com/redirect?dealID=U2ne5odE6WKyoSROQN8D2OX2aRN8CJrxoFxZ%2BktLaHg%3D) | CheapShark / IndieGala | 4.38 | 99.99 | 95.62% | 81 | Baratísimo |
| 7 | [Dockers Men's Estes Wax Casual Sneakers for $26 + free shipping w/ $39](https://www.dealnews.com/Dockers-Mens-Estes-Wax-Casual-Sneakers-for-26-free-shipping-w-39/22247053.html?iref=rss) | DealNews / Macy's | 26.00 | 50.00 | 48% | 50 | normal |
| 8 | [Suicide Squad: Kill the Justice League - Deluxe Edition](https://www.cheapshark.com/redirect?dealID=7WwX02D7gjHZXVEQR%2BugfXXSpa%2BkIt17dNTq0RrSx%2BE%3D) | CheapShark / GameBillet | 4.46 | 99.99 | 95.54% | 81 | Baratísimo |
