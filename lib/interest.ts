import type { Deal, GateReport } from './types.ts'
import { brandOf, brandTier, productKey } from './identity.ts'
import { roundup } from './errors.ts'
export type RejectReason = 'apparel' | 'food' | 'beauty' | 'seasonal-decor' | 'gift-card' | 'low-value' | 'noname-inflated' | 'middleman-duplicate' | 'catalog-price' | 'replacement-part' | 'variant-duplicate' | 'stale-price'
export const isGame = (d: Deal) => d.category === 'videojuegos'
// A store's own catalog is a price list, not a deal: nobody posted it. It feeds the
// ledger and the private watch every run, and is published only with a real discount.
export const isCatalog = (d: Deal) => !isGame(d) && !!d.direct && d.sourceUrl === d.url
const catalogDiscount = (d: Deal) => (d.reference?.kind === 'ledger' && (d.referenceDiscountPct || 0) >= 8) || (d.discountPct || 0) >= 35
const LIST_TRUST: Record<number, number> = { 0: .2, 1: .5, 2: .4 }
const DEPTH_TRUST = { ledger: 1, curated: 1, 'cross-store': .9, 'source-previous': .8 } as const
/** How strong the evidence of a low price is, 0-100. A seller's list claim counts for far less than an observed price. */
export function evidenceOf(d: Deal): number {
  const kind = d.reference?.kind
  const observed = kind && kind !== 'list' ? (d.referenceDiscountPct || 0) * DEPTH_TRUST[kind] : 0
  const claimed = (d.discountPct || 0) * (LIST_TRUST[brandTier(brandOf(d.title)) || 0] ?? .2)
  return Math.min(100, Math.max(observed, claimed) * 1.5)
}
/** Editorial order inside a band: half interest, half evidence, a little freshness, less if the price has not moved. */
export function rankValue(d: Deal, now: Date): number {
  const age = (now.getTime() - Date.parse(d.publishedAt)) / 86400000
  const fresh = Number.isFinite(age) ? 10 * Math.exp(-Math.max(0, age) / 2) : 0
  const h = d.history
  const flat = h && h.days >= 7 && Math.abs(h.maxPrice - h.minPrice) <= d.price * .02 ? 20 : 0
  return (d.interest || 0) * .5 + evidenceOf(d) * .5 + fresh - flat - (isCatalog(d) ? 10 : 0) - (/amazon\./i.test(d.storeDomain || d.store) && d.source === 'Techbargains' && !soldByAmazon(d) ? 15 : 0)
}
const MAX_PER_STORE = 12
/** No store may wall off the page: small stores are capped, and no store runs three in a row while another is waiting. */
export function diversify(deals: Deal[]): Deal[] {
  const count = new Map<string, number>(), kept: Deal[] = [], over: Deal[] = []
  for (const d of deals) {
    const n = count.get(d.store) || 0
    if (d.store !== 'Amazon' && n >= MAX_PER_STORE) { over.push(d); continue }
    count.set(d.store, n + 1); kept.push(d)
  }
  const out: Deal[] = []
  while (kept.length) {
    const a = out.at(-1)?.store, b = out.at(-2)?.store
    let i = a && a === b ? kept.slice(0, 40).findIndex(d => d.store !== a) : 0
    if (i < 0) i = 0
    out.push(kept.splice(i, 1)[0]!)
  }
  return [...out, ...over]
}
export function interestOf(d: Deal): Pick<Deal, 'interest' | 'interestSignals'> {
  let interest = 0
  const interestSignals: string[] = []
  const add = (n: number, text: string) => { interest += n; interestSignals.push(text) }
  const tier = brandTier(brandOf(d.title))
  if (tier) add(tier === 1 ? 30 : 20, 'Marca reconocida')
  if (['informatica', 'electronica', 'herramientas'].includes(d.category || '')) add(25, 'Categoría de interés técnico')
  else if (['hogar', 'cocina', 'deporte', 'juguetes'].includes(d.category || '')) add(10, 'Producto de uso duradero')
  if (['USD','EUR','GBP'].includes(d.currency) && d.price >= 25) add(10, 'Valor unitario de al menos 25')
  if (d.direct) add(15, 'Enlace directo al comercio')
  if ((d.seenIn?.length || 0) >= 2) add(15, 'Corroborado por varias fuentes')
  if (d.staffPick) add(15, 'Selección editorial de DealNews')
  // 2026-11-04: our own ledger saw it cheaper than on any earlier day (5 %+ under the prior low).
  const h = d.history
  if (h && h.days >= 2 && d.price > 0 && d.price <= h.minPrice * .95) add(10, `Nuevo mínimo frente a ${h.days} días observados`)
  return { interest: Math.min(100, interest), interestSignals }
}
// How long a posted price can be trusted. Measured 2026-11-02 on 32 Amazon rows against
// live pages: of 16 sold by Amazon (smid in the link) 1 had moved; of the third-party rows
// most had, because the posted price was a short promotion. A store's own catalog is live.
export const soldByAmazon = (d: Deal) => /[?&]smid=ATVPDKIKX0DER\b/.test(d.storeUrl || d.url)
export function maxAgeHours(d: Deal): number {
  if (isGame(d) || isCatalog(d)) return Infinity
  if (d.source === 'CamelCamelCamel') return 24
  if (/amazon\./i.test(d.storeDomain || d.store)) return soldByAmazon(d) ? 96 : 24
  return d.source === 'DealNews' ? 72 : 48
}
export function rejection(d: Deal, now?: Date): RejectReason | undefined {
  if (now && (now.getTime() - Date.parse(d.publishedAt)) / 3600000 > maxAgeHours(d)) return 'stale-price'
  if (roundup(d.title) || (d.ai?.verdict === 'noise' && d.ai.confidence >= .7)) return 'low-value'
  if (!isGame(d) && d.errorScore >= 40) return undefined
  if (isGame(d)) return undefined
  if (d.category === 'ropa') return 'apparel'
  if (d.category === 'alimentacion') return 'food'
  if (d.category === 'belleza') return 'beauty'
  if (/\b(?:christmas|halloween|holiday decor|inflatable.*(?:santa|tree)|ornaments?|pajamas?)\b/i.test(d.title)) return 'seasonal-decor'
  if (/\b(?:gift cards?|gift certificates?)\b/i.test(d.title)) return 'gift-card'
  if (/\b(?:gaskets?|pressure switch|ignition switch|inlet valve|door seal|replacement (?:part|filter|belt|hose)|oem part|[A-Z]{2}\d{2}-\d{5}[A-Z]?)\b/i.test(d.title)) return 'replacement-part'
  if (isCatalog(d) && !catalogDiscount(d)) return 'catalog-price'
  if (!brandOf(d.title) && (d.reference?.kind === 'list' || !d.reference) && (d.discountPct || 0) >= 70) return 'noname-inflated'
  if ((d.price < 15 && ['USD','EUR','GBP'].includes(d.currency)) || (d.interest || 0) < 45) return 'low-value'
  return undefined
}
// Same store, same price, same opening words: colours and sizes of one offer (eight Oura rings).
const variantKey = (d: Deal) => [d.store, d.currency, d.price, d.title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).slice(0, 4).join(' ')].join('|')
export function applyGate(deals: Deal[], now?: Date): { kept: Deal[]; gate: GateReport } {
  const gate: GateReport = { considered: deals.length, published: 0, rejected: 0, byReason: {} }
  const direct = new Set(deals.filter(d => d.direct).map(d => productKey(d) + ':' + d.currency + ':' + d.store.toLowerCase()))
  const kept: Deal[] = [], variants = new Set<string>()
  for (const input of [...deals].sort((a, b) => b.errorScore - a.errorScore || (b.reference ? 1 : 0) - (a.reference ? 1 : 0))) {
    const d = { ...input, ...interestOf(input) }
    const duplicate = !d.direct && direct.has(productKey(d) + ':' + d.currency + ':' + d.store.toLowerCase())
    const variant = variantKey(d)
    const reason = duplicate ? 'middleman-duplicate' : rejection(d, now) ?? (variants.has(variant) && d.errorScore < 40 ? 'variant-duplicate' : undefined)
    if (reason) { gate.rejected++; gate.byReason[reason] = (gate.byReason[reason] || 0) + 1 } else { variants.add(variant); kept.push(d) }
  }
  gate.published = kept.length
  return { kept, gate }
}
