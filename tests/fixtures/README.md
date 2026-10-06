# Source fixtures

Live fixtures use Node 22 fetch with `barato.si deals bot; +https://barato.si/llms.txt`. They are offline test inputs, never fallback production offers. No merchant product pages were fetched.

Captured October 6, 2026:

- `steam-search.json`: five original anchor rows from the first 100-row Steam search page; other HTML removed. Search metadata is retained.
- `gog.json`: three catalog products, retaining ID, slug, title, type, cover, exact money fields, and storeLink. Other product fields and catalog filters removed. A returned cover URL was checked with HEAD and returned HTTP 200.
- `techbargains.xml`: six original RSS 0.91 items, including a roundup, from a live 600-item feed. Only the channel wrapper is shortened. Item titles, merchant links, attribution GUIDs, and descriptions/images remain original.
- `bestbuy.json` and `woot.json`: explicitly synthetic schema fixtures, including invalid-price and variant-range cases. Neither authenticated API was contacted. Woot's shape and `/feed/All?page=1` path follow https://developer.woot.com/.

Retained October 5 fixtures:

- `dealnews.xml`: three unmodified RSS items from the recent-deals feed; shortened channel wrapper, original descriptions, and referral links. Attribution: DealNews.
- `dealnews-roundups.xml`: original DealNews items covering roundup filtering and a structured clothing price.
- `steam.json`: three original featured specials, other response categories removed.
- `epic.json`: three complete elements covering active, upcoming, and inactive promotions.
- `live-probes.json`: historical policy/transport observations, not current source configuration. Older blocked-source conclusions were superseded by the owner's exact endpoint approvals and October 6 probes documented in NOTES.md.

CheapShark and ITAD edge cases remain clearly synthetic inline tests. Legacy disabled-source adapter tests are offline compatibility checks and do not enable those sources.
