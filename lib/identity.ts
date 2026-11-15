import type { Deal } from './types.ts'

const tiers: Record<string, number> = Object.fromEntries([
  ['ASUS', 'NVIDIA', 'Dell', 'HP', 'Lenovo', 'MSI', 'Gigabyte', 'Acer', 'Apple', 'Samsung', 'LG', 'Sony', 'AMD', 'Intel', 'Corsair', 'Razer', 'Logitech', 'Bose', 'Anker', 'DeWalt', 'Milwaukee', 'Framework', 'Minisforum', 'Microsoft', 'Crucial', 'Kingston', 'Western Digital', 'Seagate', 'SanDisk', 'Epson', 'Brother', 'Canon', 'Nikon', 'Panasonic', 'TP-Link', 'Netgear', 'Ubiquiti', 'Beelink', 'GMKtec',
    // v5 (2026-11-15): household names outside tech.
    'Nike', 'adidas', 'LEGO', 'Dyson', 'Garmin', 'Nintendo', 'Sonos', 'GoPro', 'DJI', 'Google', 'KitchenAid', 'Vitamix', 'Weber', 'Yeti', 'Patagonia', 'The North Face', 'Herman Miller', 'Michelin'],
  ['Bosch', 'Makita', 'Ryobi', 'Ninja', 'Shark', 'Philips', 'EcoFlow', 'Jackery', 'Eufy', 'Blink', 'Oura', 'Ring', 'Fitbit',
    "Levi's", 'Columbia', 'Under Armour', 'Carhartt', 'New Balance', 'Crocs', 'Skechers', 'Puma', 'Reebok', 'Timberland', 'Samsonite', 'Osprey', 'Ray-Ban', 'Oakley', 'Casio', 'Seiko',
    'Stanley', 'Traeger', 'Blackstone', 'Instant Pot', 'Keurig', 'Nespresso', 'Cuisinart', 'Le Creuset', 'OXO', 'Breville', 'Hamilton Beach', 'iRobot', 'Roborock', 'Bissell', 'Hoover', 'Honeywell',
    'Casper', 'Tempur-Pedic', 'Sealy', 'Serta', 'Steelcase', 'Coleman', 'Hasbro', 'Mattel', 'Fisher-Price', 'Graco', 'Chicco', 'Pampers', 'Huggies', 'Goodyear', 'Craftsman', 'Black+Decker',
    'Greenworks', 'EGO', 'WORX', 'Husqvarna', 'Roku', 'Fender', 'Yamaha', 'Oral-B',
    // Brands read through their own stores (scripts/sources.ts).
    'Our Place', 'HexClad', 'Ooni', 'Fellow', 'Roborock', 'Dreame', 'Wyze', 'Twelve South', '8BitDo', 'Satechi', 'Keychron', 'ELEGOO', 'Allbirds', 'Cotopaxi', 'Rumpl', 'Wild One', 'Braun', 'Olay', 'CeraVe', 'Neutrogena', 'Gillette', 'Purina', 'Bowflex', 'Peloton', 'Schwinn', 'Callaway', 'JBL', 'Sennheiser', 'Audio-Technica', 'SteelSeries', 'Thermaltake', 'NZXT', 'G.Skill', 'Patriot', 'AOOSTAR', 'Pioneer', 'Onkyo', 'Denon'],
].flatMap((brands, i) => brands.map(b => [b, i + 1])))
const escape = (s: string) => s.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')
export function brandOf(title: string): string | null {
  return Object.keys(tiers).map(brand => ({ brand, index: title.search(new RegExp('(?:^|[^a-z0-9])' + escape(brand) + '(?=$|[^a-z0-9])', 'i')) })).filter(b => b.index >= 0).sort((a,b) => a.index-b.index)[0]?.brand || null
}
export const brandTier = (brand: string | null | undefined): number => brand ? tiers[brand] || 0 : 0
export function asinFrom(url: string | null | undefined): string | null {
  try {
    const u = new URL(url || '')
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const match = host === 'amazon.com' ? /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i.exec(u.pathname)
      : host === 'camelcamelcamel.com' ? /\/product\/([A-Z0-9]{10})(?:\/|$)/i.exec(u.pathname) : null
    return match?.[1]?.toUpperCase() || null
  } catch { return null }
}
export function productKey(d: Pick<Deal, 'id' | 'url' | 'storeUrl' | 'sourceUrl'>): string {
  for (const link of [d.storeUrl, d.url, d.sourceUrl]) {
    const asin = asinFrom(link)
    if (asin) return 'asin:' + asin
  }
  for (const link of [d.storeUrl, d.url]) {
    try {
      const u = new URL(link || ''), host = u.hostname.replace(/^www\./, '')
      const sku = host === 'bestbuy.com' && (/\/(\d+)\.p$/.exec(u.pathname)?.[1] || u.searchParams.get('skuId'))
      if (sku && /^\d+$/.test(sku)) return 'bestbuy:' + sku
      const steam = host === 'store.steampowered.com' && /^\/app\/(\d+)/.exec(u.pathname)
      if (steam) return 'steam:' + steam[1]
      const shopify = /^\/products\/([a-z0-9-]+)\/?$/i.exec(u.pathname)
      if (shopify) return 'shopify:' + host + ':' + shopify[1]
    } catch { /* invalid URL */ }
  }
  return 'url:' + d.id
}
/** Full manufacturer model identifiers, never a shared GPU/CPU/capacity specification. */
export function strongModel(title: string): string | null {
  const tokens = title.toUpperCase().match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g) || []
  return tokens.find(t => t.length >= 8 && /[A-Z]/.test(t) && /\d/.test(t)
    && !/^(?:RTX|GTX|RX|DDR|PCIE|USB|HDMI|WIFI|CORE|RYZEN|[0-9]+(?:GB|TB|MHZ|GHZ|WH|MAH))/.test(t)
    && /(?:[A-Z]{2,}\d{3,}[A-Z]|[A-Z]\d[A-Z].*\d|[A-Z]{2,}-\d{3,})/.test(t)) || null
}
export function isDirect(d: Pick<Deal, 'url' | 'storeUrl' | 'storeDomain'>): boolean {
  try {
    const u = new URL(d.storeUrl || d.url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const domain = d.storeDomain?.replace(/^www\./, '').toLowerCase()
    return u.protocol === 'https:' && !!domain && (host === domain || host.endsWith('.' + domain))
      && !/(?:^|\.)(?:dealnews|cheapshark|techbargains|camelcamelcamel|isthereanydeal)\.com$/.test(host)
  } catch { return false }
}
