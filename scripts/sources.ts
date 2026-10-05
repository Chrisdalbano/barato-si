import type { Source } from '../lib/normalize.ts'

export const sources: Source[] = [
  { name: 'cheapshark', kind: 'cheapshark', url: 'https://www.cheapshark.com/api/1.0/deals?pageSize=60&sortBy=Savings&onSale=1' },
  { name: 'slickdeals-frontpage', kind: 'rss', url: 'https://slickdeals.net/newsearch.php?mode=frontpage&rss=1', disabled: 'Permission required by Slickdeals terms; RSS search path also robots-disallowed.' },
  { name: 'slickdeals-popular', kind: 'rss', url: 'https://slickdeals.net/newsearch.php?mode=popdeals&rss=1', disabled: 'Permission required by Slickdeals terms; RSS search path also robots-disallowed.' },
  { name: 'dealnews', kind: 'rss', url: 'https://www.dealnews.com/?rss=1&sort=time' },
  ...['deals', 'buildapcsales', 'GameDeals'].map(sub => ({ name: `reddit-${sub}`, kind: 'reddit' as const, url: `https://www.reddit.com/r/${sub}/hot.json?limit=50` })),
  { name: 'woot', kind: 'woot', url: 'https://developer.woot.com/feed/All', disabled: 'Official API requires x-api-key; legacy /blog/feed.rss returned HTTP 404.' },
  { name: 'ebay', kind: 'rss', url: 'https://www.ebay.com/rps/feed/v1.1/epn/feed.xml', disabled: 'Legacy deals RSS returned HTTP 404; no open replacement verified.' },
  { name: 'epic', kind: 'epic', url: 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US', disabled: 'HTTP 200 in live probe, but no documented public syndication permission verified.' },
  { name: 'steam', kind: 'steam', url: 'https://store.steampowered.com/api/featuredcategories?cc=us&l=english', disabled: 'HTTP 200 in live probe, but undocumented storefront endpoint; syndication permission unverified.' },
]
