# Source fixtures

Captured locally on 2026-10-05 using Node 22 built-in fetch and the production bot User-Agent.

- `dealnews.xml`: three unmodified RSS items from https://www.dealnews.com/?rss=1&sort=time; the channel wrapper is shortened. Attribution: DealNews. Original descriptions and referral links are preserved.
- `dealnews-roundups.xml`: unmodified items from that same live feed, including sale roundups which must not turn into single-product pricing errors.
- `steam.json`: first three specials from https://store.steampowered.com/api/featuredcategories?cc=us&l=english. Other response categories removed.
- `epic.json`: three complete elements from https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US (active, future, inactive); other elements removed.
- `live-probes.json`: actual robots responses, HTTP statuses, redirect destinations and short response prefixes. These are evidence of access failures, not fabricated deal responses.

Steam and Epic fixtures test dormant adapters; neither source is enabled for production without verified syndication permission. CheapShark and all three Reddit endpoints were **not fetched** because their live robots rules disallow them. Slickdeals search RSS is also disallowed; its legacy RSS entry point redirects to FeedBurner, whose robots endpoint returned HTML. Woot's old RSS and eBay's old feed returned 404. No successful live deal fixture can honestly be supplied for those sources. Tests instead replay their real policy/transport outcomes and separately exercise synthetic, explicitly labelled adapter edge cases. No product pages were fetched.

Source permission references and interpretation are recorded in root NOTES.md. These fixtures are offline tests, never fallback offers on the live site.
