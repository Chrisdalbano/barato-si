import { decodeEntities, plainText } from './feeds.ts'
import type { Deal } from './types.ts'

export type Offer = Omit<Partial<Deal>, 'price'> & { title: string; url: string; price: number | null }
const amount = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
export function steamSearch(data: any): Offer[] {
  if (!data?.success || typeof data.results_html !== 'string') throw new Error('Invalid Steam search schema')
  return [...data.results_html.matchAll(/<a\b[^>]*href="(https:\/\/store\.steampowered\.com\/(?:app|sub|bundle)\/\d+\/[^\"]*)"[^>]*>[\s\S]*?<\/a>/gi)].flatMap((m: any) => {
    const row = m[0]
    const title = plainText(/<span class="title">([\s\S]*?)<\/span>/.exec(row)?.[1] || '')
    const cents = amount(/data-price-final="(\d+)"/.exec(row)?.[1])
    const original = plainText(/class="discount_original_price"[^>]*>([\s\S]*?)<\/div>/.exec(row)?.[1] || '').replace(/[$,]/g, '')
    if (!title || cents === null || !/class="discount_pct"[^>]*>\s*-\d+%/.test(row)) return []
    const url = new URL(decodeEntities(m[1])); url.search = ''
    return [{ title, url: url.href, store: 'Steam', category: 'videojuegos', currency: 'USD', price: cents / 100, listPrice: amount(original), image: decodeEntities(/<img[^>]+src="([^"]+)"/.exec(row)?.[1] || '') }]
  })
}
export function gogCatalog(data: any): Offer[] {
  if (!Array.isArray(data?.products)) throw new Error('Invalid GOG schema')
  return data.products.flatMap((r: any) => {
    const p = r.price
    if (typeof r.title !== 'string' || typeof r.slug !== 'string' || !['game', 'pack'].includes(r.productType) || !p?.finalMoney?.currency || p.finalMoney.currency !== p.baseMoney?.currency) return []
    const price = amount(p.finalMoney.amount), listPrice = amount(p.baseMoney.amount)
    if (price === null || listPrice === null || price >= listPrice) return []
    return [{ title: r.title, url: r.storeLink || `https://www.gog.com/en/game/${r.slug}`, store: 'GOG', category: 'videojuegos', price, listPrice, currency: p.finalMoney.currency, image: typeof r.coverHorizontal === 'string' ? r.coverHorizontal.replace(/_?\{formatter\}/g, '_product_tile_304') : null }]
  })
}
export function bestBuyProducts(data: any): Offer[] {
  if (!Array.isArray(data?.products)) throw new Error('Invalid Best Buy schema')
  return data.products.flatMap((r: any) => typeof r.name !== 'string' || amount(r.salePrice) === null || !(r.regularPrice > r.salePrice) ? [] : [{ title: r.name, url: r.url, store: 'Best Buy', price: amount(r.salePrice), listPrice: amount(r.regularPrice), image: r.image, category: r.categoryPath?.map((c: any) => c.name).join(' ') || null }])
}
