import type { Source } from '../lib/normalize.ts'

// Rejected candidates are documented in NOTES.md, not published as product sources.
export function configuredSources(env: Record<string, string | undefined> = process.env): Source[] {
  return [
    { name: 'CheapShark', kind: 'cheapshark', url: 'https://www.cheapshark.com/api/1.0/deals?pageSize=60&sortBy=Savings&onSale=1' },
    { name: 'Steam', kind: 'steam', url: 'https://store.steampowered.com/api/featuredcategories?cc=us&l=english' },
    { name: 'Epic', kind: 'epic', url: 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US' },
    { name: 'DealNews', kind: 'rss', url: 'https://www.dealnews.com/?rss=1&sort=time' },
    ...(env.ITAD_API_KEY ? [{ name: 'IsThereAnyDeal', kind: 'itad' as const, url: 'https://api.isthereanydeal.com/deals/v2?country=US&limit=60&sort=-cut', apiKey: env.ITAD_API_KEY }] : []),
  ]
}
export const sources = configuredSources()
