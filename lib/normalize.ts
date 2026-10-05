import { cheapSharkStores } from './cheapshark-stores.ts'
import type { Deal } from './types.ts'
import { parsePrices } from './prices.ts'
import { discount, scoreDeal } from './rank.ts'
import { canonicalUrl, dealId } from './dedupe.ts'
import { decodeEntities, feedItems, plainText, tag } from './feeds.ts'

export type SourceKind = 'cheapshark' | 'rss' | 'reddit' | 'woot' | 'epic' | 'steam' | 'itad'
export interface Source { name: string; url: string; kind: SourceKind; disabled?: string; apiKey?: string }
type Row = Record<string, any>
const number = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null
const date = (v: unknown, fallback: string): string => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : fallback
// API IDs may already be percent-encoded; encode exactly once for redirect links.
export function cheapSharkDealId(value: string): string {
  try { return encodeURIComponent(decodeURIComponent(value)) } catch { return encodeURIComponent(value) }
}
const safeUrl = (v: unknown): string | null => typeof v === 'string' && canonicalUrl(v) ? v : null

export function normalizeSource(source: Source, raw: string, now: Date, previous: Deal[] = []): Deal[] {
  const seen = new Map(previous.map(d => [d.id, d]))
  const output: Deal[] = []
  const stamp = now.toISOString()
  function add(row: Omit<Partial<Deal>, 'price'> & { title: string; url: string; price: number | null }) {
    if (!row.title.trim() || !safeUrl(row.url) || row.price === null || number(row.price) === null) return
    const id = dealId(row.url)
    const old = seen.get(id)
    const listPrice = row.listPrice != null && number(row.listPrice) !== null && row.listPrice > row.price ? row.listPrice : null
    const base = {
      ...row, id, title: row.title.trim(), url: row.url, source: source.name, sourceUrl: safeUrl(row.sourceUrl) || new URL('/', source.url).href,
      store: row.store || source.name, currency: row.currency || 'USD', price: row.price,
      listPrice, discountPct: discount(row.price, listPrice), image: safeUrl(row.image), category: row.category || null,
      publishedAt: date(row.publishedAt, old?.publishedAt || stamp), foundAt: old?.foundAt || stamp,
    } as Omit<Deal, 'score' | 'flag' | 'reasons'>
    output.push({ ...base, ...scoreDeal(base, now) })
  }
  if (source.kind === 'rss') {
    for (const item of feedItems(raw)) {
      const title = tag(item, 'title')
      if (/\b(?:expired|sold out|dead deal)\b/i.test(title)) continue
      if (/\b(?:up to|from|starting at)\s*(?:[$€£]|\d)|\b(?:sitewide|storewide|buy one get)\b/i.test(title)) continue
      const expires = tag(item, 'dealnews:expires')
      if (expires && Date.parse(expires) <= now.getTime()) continue
      const descriptionHtml = tag(item, 'description')
      const titlePrices = parsePrices(title)
      // A roundup's description can contain several unrelated products and list prices.
      if (titlePrices.price === null) continue
      const parsed = parsePrices(title + ' ' + plainText(descriptionHtml))
      const structured = tag(item, 'dealnews:price')
      const currency = /<dealnews:price[^>]*currency="([A-Z]{3})"/.exec(item)?.[1] || parsed.currency
      const price = structured ? number(structured) : titlePrices.price
      if (price === 0 && /\b(?:trial|purchase|order|subscription|membership|with)\b|\bw\//i.test(title)) continue
      const url = tag(item, 'link') || decodeEntities(/<link[^>]+href="([^"]+)"/.exec(item)?.[1] || '')
      // Only source-hosted item pages qualify as attribution, not merchant links or opaque GUIDs.
      const sourceUrl = [tag(item, 'guid'), url].find(candidate => safeUrl(candidate)
        && new URL(candidate).hostname === new URL(source.url).hostname && candidate !== source.url)
      add({ title, url, sourceUrl, price, listPrice: parsed.currency === currency ? parsed.listPrice : null, currency,
        store: tag(item, 'dealnews:retailer') || source.name, publishedAt: tag(item, 'pubDate') || tag(item, 'updated'),
        sourceText: plainText(descriptionHtml),
        category: tag(item, 'dealnews:category') || null,
        image: decodeEntities(/<media:content[^>]+url="([^"]+)"/.exec(item)?.[1] || '') || null,
        sourceSignal: number(tag(item, 'slickdeals:score')) ?? undefined,
        ...(source.name.toLowerCase() === 'dealnews' ? { syndication: { attribution: 'DealNews', feedUrl: source.url, itemXml: item, descriptionHtml } } : {}),
      })
    }
    return output
  }
  const data = JSON.parse(raw)
  let rows: Row[]
  switch (source.kind) {
    case 'cheapshark': rows = data; break
    case 'reddit': rows = data?.data?.children?.map((x: Row) => x.data); break
    case 'woot': rows = data?.Items; break
    case 'epic': rows = data?.data?.Catalog?.searchStore?.elements; break
    case 'itad': rows = data?.list; break
    case 'steam': rows = data?.specials?.items; break
  }
  if (!Array.isArray(rows)) throw new Error(`Unexpected ${source.kind} response schema`)
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    if (source.kind === 'cheapshark') {
      if (!cheapSharkStores[r.storeID] || r.isOnSale !== '1' || !r.dealID || typeof r.title !== 'string') continue
      add({ title: r.title, url: `https://www.cheapshark.com/redirect?dealID=${cheapSharkDealId(r.dealID)}`, store: cheapSharkStores[r.storeID],
        price: number(r.salePrice), listPrice: number(r.normalPrice), currency: 'USD', category: 'videojuegos', image: r.thumb,
        publishedAt: number(r.lastChange) !== null ? new Date(Number(r.lastChange) * 1000).toISOString() : undefined,
        sourceSignal: number(r.dealRating) !== null ? Number(r.dealRating) * 10 : undefined })
    } else if (source.kind === 'itad') {
      const offer = r.deal
      if (typeof r.title !== 'string' || !offer || !(offer.cut > 0) || (offer.expiry && (!Number.isFinite(Date.parse(offer.expiry)) || Date.parse(offer.expiry) <= now.getTime()))) continue
      if (offer.price?.currency !== offer.regular?.currency) continue
      add({ title: r.title, url: offer.url, sourceUrl: 'https://isthereanydeal.com/', store: offer.shop?.name,
        price: number(offer.price?.amount), listPrice: number(offer.regular?.amount), currency: offer.price?.currency,
        category: 'videojuegos', publishedAt: offer.timestamp, image: r.assets?.banner300 })
    } else if (source.kind === 'steam') {
      if (!r.discounted || typeof r.name !== 'string' || !Number.isInteger(r.id) || ![0, 1, 2].includes(r.type) || r.currency !== 'USD' || (r.discount_expiration && r.discount_expiration * 1000 <= now.getTime())) continue
      add({ title: r.name, url: `https://store.steampowered.com/${r.type === 0 ? 'app' : r.type === 1 ? 'sub' : 'bundle'}/${r.id}/`, store: 'Steam', currency: r.currency,
        price: number(r.final_price) === null ? null : r.final_price / 100, listPrice: number(r.original_price) === null ? null : r.original_price / 100,
        category: 'videojuegos', image: r.header_image })
    } else if (source.kind === 'epic') {
      const offer = r.promotions?.promotionalOffers?.flatMap((p: Row) => p.promotionalOffers || []).find((p: Row) => Date.parse(p.startDate) <= now.getTime() && Date.parse(p.endDate) > now.getTime() && p.discountSetting?.discountPercentage === 0)
      const p = r.price?.totalPrice
      const slug = r.offerMappings?.find((m: Row) => m.pageType === 'productHome')?.pageSlug || r.catalogNs?.mappings?.[0]?.pageSlug || r.productSlug?.replace(/\/home$/, '')
      if (!offer || p?.discountPrice !== 0 || !slug || typeof r.title !== 'string') continue
      const decimals = p.currencyInfo?.decimals
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) continue
      add({ title: r.title, url: `https://store.epicgames.com/en-US/p/${slug}`, store: 'Epic Games', price: 0,
        listPrice: number(p.originalPrice) === null ? null : p.originalPrice / 10 ** decimals, currency: p.currencyCode,
        category: 'videojuegos', publishedAt: offer.startDate, image: r.keyImages?.find((i: Row) => i.type === 'OfferImageWide')?.url })
    } else if (source.kind === 'reddit') {
      if (r.over_18 || r.stickied || r.removed_by_category || typeof r.title !== 'string' || /expired|sold out/i.test(r.link_flair_text || '')) continue
      add({ title: r.title, url: r.url, ...parsePrices(r.title), store: r.domain, category: /GameDeals/i.test(source.name) ? 'videojuegos' : null,
        publishedAt: number(r.created_utc) !== null ? new Date(r.created_utc * 1000).toISOString() : undefined, sourceSignal: number(r.score) ?? undefined })
    } else if (source.kind === 'woot') {
      if (r.IsSoldOut || typeof r.Title !== 'string' || Date.parse(r.EndDate) <= now.getTime() || r.SalePrice?.Minimum !== r.SalePrice?.Maximum) continue
      add({ title: r.Title, url: r.Url, store: 'Woot', price: number(r.SalePrice?.Minimum), listPrice: number(r.ListPrice?.Minimum), currency: 'USD', publishedAt: r.StartDate, image: r.Photo })
    }
  }
  return output
}
