# barato.si v3: what we copied, what we refused

Written 2026-11-02 by the operator. Worktree `barato-v3`, branch `v3`. Owner brief:
real interesting deals (no joke pajamas), price errors first, direct product links,
a private AI-hardware watch, a professional site with serious filtering.

## Reverse engineering, from public behaviour and docs only

**CamelCamelCamel** (founder interview, SED 837, 2019; public feed probed 2026-11-02):
- Identity is the ASIN. Everything hangs off one product key.
- It owns a price series for each product, so "good price" means good against its own
  history, not the seller's list price.
- Polling is a priority queue: products someone tracks go first. Quota is finite.
- It stays on the sanctioned API and treats scraping Amazon as a losing fight.
- Public RSS: `https://camelcamelcamel.com/top_drops/feed`, 20 items, title form
  `<name> - down 47.72% ($9.12) to $9.99 from $19.11`, link `/product/<ASIN>`. robots allows it.
  Category query params appear to have no effect, so we filter ourselves.

**Slickdeals** (alert form, How It Works page, forum staff replies):
- Discovery is noisy on purpose; the filter is the product. A deal earns standing.
- An alert is a rule: keyword + store + category + brand + minimum rating + delivery + timing.
- Editors check price history, reviews, availability and inventory only on deals that rose.
- We keep the owner's 2026-10-06 decision not to ingest Slickdeals RSS. We copy the shape.

**What the sum looks like:** CamelCamelCamel's ledger + Slickdeals' standing filter.

```
sources -> normalize -> productKey -> LEDGER (every collected offer, not just published)
       -> reference price (best evidence available) -> error score
       -> interest gate (replaces votes) -> rank -> publish + private watch
```

## Where the old engine fails, measured on the 2026-11-01 file

- 281 of 306 Amazon rows have no list price. Without one the score tops out at 65,
  below the 70 needed for "probable error". `errors.json` was empty.
- `readPrevious` only reads published archives, so history exists only for what already
  made the top 400. A product's first drop has nothing to compare against.
- Top non-game rows on that day: noname jump starters, sticky bra pads, Crocs, an
  inflatable Christmas tree. Score rewards a seller's list price, which nonames inflate.
- 44 Amazon rows link to dealnews.com; those carry no merchant link.

## Design

1. **Product key.** `asin:B0…`, `bestbuy:<sku>`, `shopify:<domain>:<handle>`, `steam:<id>`,
   else `url:<dealId>`. ASIN comes from a merchant URL or the CamelCamelCamel link.
2. **Ledger.** `data/price-ledger.json`: every collected non-game offer before the cap,
   keyed by product key, keeps the daily low per UTC day for 120 days. Seeded from the
   archives on first run. Committed, size-capped; the largest entries lose oldest days first.
3. **Reference price**, strongest evidence first:
   `ledger` (3+ observed days, median) > `cross-store` (same key/model, another merchant) >
   `curated` (`data/reference-prices.json`, dated, spec floors and MSRPs) >
   `source-previous` (CamelCamelCamel's "from") > `list` (seller's claim, weakest).
4. **Error score v3.** Depth against the reference, weighted by how much the evidence is
   worth. A list-price claim alone cannot reach 70 on a noname brand. A ledger or curated
   reference can reach 100 with no list price at all. Keep every existing demotion
   (refurb, coupon, roundup, stable price, games cap). Every point stays explainable in
   `errorSignals`. Thresholds stay 40/70. Never lower them to fill a page.
5. **Interest gate** (replaces votes): brand tier, category tier, price floor, direct link,
   corroboration (2+ sources), DealNews `staffPick`. Below the gate the offer is not published
   unless it is an error candidate. The ledger keeps it either way. Counts of what was
   rejected and why are published in `DealsFile.gate`. Publishing fewer deals is fine.
6. **Direct links.** `direct: true` only when the link goes to the merchant. Canonical
   `https://www.amazon.com/dp/<ASIN>` from a known ASIN is allowed (owner decision 2026-11-02,
   amends the "never synthesize" rule for this one deterministic form). Middleman-only rows
   rank below direct ones and the site defaults to direct-only.
7. **Sources.** Add CamelCamelCamel RSS. Add `shopify` kind (`/products.json`, robots-checked,
   `compare_at_price`) for a curated merchant list, each verified live. Add dormant `keepa`
   adapter (needs `KEEPA_API_KEY`). Best Buy stays dormant until the owner adds a key.
   Bot walls stay walls: no UA disguise, no proxies, no bypass.
8. **Private watch.** `scripts/watch.ts` reads gitignored `data/private/watchlist.json`, runs
   on the owner's PC only (never CI, repo is public), matches every collected offer plus a short list of
   robots-allowed product URLs with JSON-LD prices, keeps `data/private/watch-history.json`,
   and writes a Desk card on a hit through `$BARATO_BOARD_CMD`. Nothing from it is published.

## Honest limits

No feed is "before anyone else": feeds are downstream of whoever posted first, and only
a direct catalog API (Best Buy, Keepa) sees a price change first-hand. Price errors are
often cancelled by the merchant. Copy must say so.
