import type { Source } from '../lib/normalize.ts'

export function configuredSources(env: Record<string, string | undefined> = process.env): Source[] {
  const cheap = (n: number) => `https://www.cheapshark.com/api/1.0/deals?pageNumber=${n}&pageSize=60&sortBy=Savings&onSale=1`
  const steam = (n: number) => `https://store.steampowered.com/search/results/?query&start=${n}&count=100&specials=1&infinite=1&json=1&cc=us&l=english`
  const gog = (n: number) => `https://catalog.gog.com/v1/catalog?limit=100&order=desc:discount&discounted=eq:true&countryCode=US&currencyCode=USD&productType=in:game,pack&page=${n}`
  return [
    { name: 'CheapShark', kind: 'cheapshark', direct: false, url: cheap(0), pages: [0, 1, 2].map(n => ({ url: cheap(n) })) },
    { name: 'Steam', kind: 'steam', direct: true, url: 'https://store.steampowered.com/api/featuredcategories?cc=us&l=english', pages: [{ url: 'https://store.steampowered.com/api/featuredcategories?cc=us&l=english' }, ...[0, 100, 200].map(n => ({ url: steam(n), kind: 'steam-search' as const }))] },
    { name: 'Epic', kind: 'epic', direct: true, url: 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US' },
    { name: 'DealNews', kind: 'rss', direct: false, url: 'https://www.dealnews.com/?rss=1&sort=time', pages: ['?rss=1&sort=time', 'c142/Electronics/?rss=1', 'c39/Computers/?rss=1', 'c196/Home-Garden/?rss=1', 's313/Amazon/?rss=1', 'c211/Sports-Fitness/?rss=1', 'c202/Clothing-Accessories/?rss=1',
      // v5 (2026-11-15), each checked live with the collector's own reader: the hottest list, Walmart, and six more departments.
      '?rss=1&sort=hotness', 's321/Walmart/?rss=1', 'c238/Automotive/?rss=1', 'c182/Office-School-Supplies/?rss=1', 'c186/Gaming-Toys/?rss=1', 'c756/Health-Beauty/?rss=1', 'c178/Movies-Music-Books/?rss=1', 'c206/Travel-Entertainment/?rss=1'].map(path => ({ url: 'https://www.dealnews.com/' + path })) },
    { name: 'GOG', kind: 'gog', direct: true, url: gog(1), pages: [1, 2, 3].map(n => ({ url: gog(n) })) },
    { name: 'Techbargains', kind: 'rss', direct: false, url: 'https://www.techbargains.com/rss.xml' },
    ...[{ name: 'Minisforum', host: 'store.minisforum.com' }, { name: 'GMKtec', host: 'www.gmktec.com' }, { name: 'AOOSTAR', host: 'aoostar.com' },
      // v5 (2026-11-15): brands' own stores outside mini PCs, for a general index. Same public catalog endpoint,
      // one request each, robots.txt honoured by the reader. Each answered the collector on 2026-11-15 with list prices.
      // Only rows the store itself marks down are read (saleOnly), so their full catalogs stay out of the price ledger.
      // A catalog row is published only with a real cut (lib/interest.ts catalogDiscount) and six per store at most.
      { name: 'Our Place', host: 'fromourplace.com', category: 'cocina', only: true }, { name: 'HexClad', host: 'hexclad.com', category: 'cocina', only: true },
      { name: 'Stanley', host: 'www.stanley1913.com', category: 'cocina', only: true }, { name: 'Ooni', host: 'ooni.com', category: 'cocina', only: true },
      { name: 'Fellow', host: 'fellowproducts.com', category: 'cocina', only: true }, { name: 'Roborock', host: 'us.roborock.com', category: 'hogar' },
      { name: 'Dreame', host: 'www.dreametech.com', category: 'hogar' }, { name: 'Wyze', host: 'www.wyze.com', category: 'electronica' },
      { name: 'EcoFlow', host: 'us.ecoflow.com', category: 'electronica' }, { name: 'Jackery', host: 'www.jackery.com', category: 'electronica' },
      { name: 'Twelve South', host: 'www.twelvesouth.com', category: 'electronica' }, { name: '8BitDo', host: 'shop.8bitdo.com', category: 'electronica' },
      { name: 'Satechi', host: 'satechi.com', category: 'informatica' }, { name: 'Keychron', host: 'www.keychron.com', category: 'informatica', only: true },
      { name: 'ELEGOO', host: 'us.elegoo.com', category: 'informatica' }, { name: 'Allbirds', host: 'www.allbirds.com', category: 'ropa', only: true },
      { name: 'Cotopaxi', host: 'www.cotopaxi.com', category: 'ropa', only: true }, { name: 'Rumpl', host: 'www.rumpl.com', category: 'deporte', only: true },
      { name: 'Wild One', host: 'wildone.com', category: 'mascotas', only: true },
    ].map((m: { name: string; host: string; category?: string; only?: boolean }) => ({ name: m.name, kind: 'shopify' as const, direct: true, url: 'https://' + m.host + '/products.json?limit=250', ...(m.category ? { category: m.category, saleOnly: true, ...(m.only ? { onlyCategory: true } : {}) } : {}) })),
    // v5 (2026-11-15): six feeds, seven seconds apart. The seventh request in a row drew HTTP 429 three runs running,
    // whatever the pacing, so the unfiltered list (the old fourth feed) made room for three more departments.
    { name: 'CamelCamelCamel', kind: 'camelcamelcamel', direct: false, url: 'https://camelcamelcamel.com/top_drops/feed?t=daily', pages: ['t=daily', 't=daily&bn=electronics', 't=daily&bn=appliances', 't=daily&bn=toys-games', 't=daily&bn=sports-outdoors', 't=daily&bn=health-personal-care'].map(q => ({ url: 'https://camelcamelcamel.com/top_drops/feed' + (q ? '?' + q : '') })) },
    ...(env.KEEPA_API_KEY ? [{ name: 'Keepa', kind: 'keepa' as const, direct: false, url: 'https://api.keepa.com/deal?selection=' + encodeURIComponent(JSON.stringify({ page: 0, domainId: 1, priceTypes: [0], dateRange: 0, isRangeEnabled: true, deltaPercentRange: [40,100], sortType: 4 })), apiKey: env.KEEPA_API_KEY }] : []),
    ...(env.BESTBUY_API_KEY ? [{ name: 'Best Buy', kind: 'bestbuy' as const, direct: true, url: 'https://api.bestbuy.com/v1/products(onSale=true&percentSavings>60)?format=json&show=sku,name,salePrice,regularPrice,percentSavings,image,url,categoryPath.name&pageSize=100&sort=percentSavings.desc', apiKey: env.BESTBUY_API_KEY }] : []),
    ...(env.WOOT_API_KEY ? [{ name: 'Woot', kind: 'woot' as const, direct: true, url: 'https://developer.woot.com/feed/All?page=1', apiKey: env.WOOT_API_KEY }] : []),
    ...(env.ITAD_API_KEY ? [{ name: 'IsThereAnyDeal', kind: 'itad' as const, direct: false, url: 'https://api.isthereanydeal.com/deals/v2?country=US&limit=60&sort=-cut', apiKey: env.ITAD_API_KEY }] : []),
  ]
}
export const sources = configuredSources()
