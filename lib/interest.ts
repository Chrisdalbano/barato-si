import type { Deal, GateReport } from './types.ts'
import { brandOf, brandTier, productKey } from './identity.ts'
import { roundup } from './errors.ts'
export type RejectReason = 'store-cap' | 'apparel' | 'food' | 'beauty' | 'seasonal-decor' | 'gift-card' | 'low-value' | 'noname-inflated' | 'middleman-duplicate' | 'catalog-price' | 'replacement-part' | 'variant-duplicate' | 'stale-price' | 'not-consumer' | 'unvetted-drop'
export const isGame = (d: Deal) => d.category === 'videojuegos'
// A store's own catalog is a price list, not a deal: nobody posted it. It feeds the
// ledger and the private watch every run, and is published only with a real discount.
export const isCatalog = (d: Deal) => !isGame(d) && !!d.direct && d.sourceUrl === d.url
const catalogDiscount = (d: Deal) => (d.reference?.kind === 'ledger' && (d.referenceDiscountPct || 0) >= 8) || (d.discountPct || 0) >= 35
const TECHNICAL = ['informatica', 'electronica', 'herramientas']
const DURABLE = ['hogar', 'cocina', 'deporte', 'juguetes', 'muebles', 'jardin', 'motor', 'oficina', 'mascotas', 'bebes', 'ocio', 'salud', 'viajes']
// Categories where a no-name or a shallow cut is noise: published only with a name behind it and a deep cut.
const SOFT: Record<string, RejectReason> = { ropa: 'apparel', alimentacion: 'food', belleza: 'beauty' }
const SOFT_MIN_DEPTH = 40
/** The deepest cut the row can show: against its reference, or the seller's own claim. */
export const depthFor = (d: Deal): number => Math.max(d.referenceDiscountPct || 0, d.discountPct || 0)
/** Depth against a price somebody observed (ledger, another store, a curated or reported price), never a seller's list. */
export const observedDepth = (d: Deal): number => d.reference && d.reference.kind !== 'list' ? d.referenceDiscountPct || 0 : 0
/** Brand tier of a row. A brand's own store rarely repeats its name in the title, so there the store is the brand. */
export const tierOf = (d: Deal): number => brandTier(brandOf(d.title)) || (isCatalog(d) ? brandTier(brandOf(d.store)) : 0)
// 2026-11-24: the page is for shoppers. Trade, clinical, datacenter, installer and foodservice goods
// can show a huge observed cut (an SFP+ transceiver at 14 % of its price led the page) and still be
// nothing a person hunts for. Checked before the price-error pass: a mistake on a pallet jack is not a find.
const TRADE = /\b(?:industrial|janitorial|food ?service|restaurant (?:supply|equipment)|commercial[- ](?:grade|kitchen|ice|refrigerat\w+|freezer|oven|mixer|dishwasher|vacuum|mower)|ice storage bin|plumbed|(?:large|small) business|NSF[- ]certified|Q?SFP\+?|transceivers?|\d+GBASE\S*|fiber (?:optic|patch|media)\w*|rack[- ]?mount\w*|\d{1,2}U (?:chassis|rack|server|standard|enclosure|cabinet)|server (?:chassis|rack|rails?|cabinet)|patch panel|KVM switch|PDU|sphygmomanomet\w*|surgical|medical[- ](?:grade|suppl\w+)|exam(?:ination)? gloves|catheters?|ostomy|specimen|\d+-\d+ ?mmHg|equine|veterinary|livestock|foggers?|transfer pump|chemical (?:pump|sprayer|resistant)|pallets?|forklift|conveyor|thermal transfer|barcode (?:scanner|printer|label)\w*|receipt printer|cash drawer|POS (?:system|terminal)|cubicles?|conference (?:table|room)|reception desk|lateral fil(?:e|ing)|shower door|stereo install\w*|wiring harness|trolling motor|pack of (?:[4-9]\d|\d{3,})|(?:[2-9]\d{2}|\d{4,}) count total|case of \d{2,})(?=$|[^a-z0-9+])/i
export const tradeItem = (title: string): boolean => TRADE.test(title)
// CamelCamelCamel's lists are every Amazon price drop, unedited, with titles cut short. A row from
// there is published only with a name people know or from an aisle people browse for fun.
const HUNTED = ['videojuegos', 'juguetes', 'deporte', 'ocio', 'bebes']
export const unvetted = (d: Deal): boolean => d.source === 'CamelCamelCamel' && !tierOf(d) && !HUNTED.includes(d.category || '')
/** A store's own catalog may fill this many places, deepest cuts first. */
export const CATALOG_PER_STORE = 6
const LIST_TRUST: Record<number, number> = { 0: .2, 1: .5, 2: .4 }
const DEPTH_TRUST = { ledger: 1, curated: 1, 'cross-store': .9, 'source-previous': .8 } as const
/** How strong the evidence of a low price is, 0-100. A seller's list claim counts for far less than an observed price. */
export function evidenceOf(d: Deal): number {
  const kind = d.reference?.kind
  const observed = kind && kind !== 'list' ? (d.referenceDiscountPct || 0) * DEPTH_TRUST[kind] : 0
  const claimed = (d.discountPct || 0) * (LIST_TRUST[tierOf(d)] ?? .2)
  return Math.min(100, Math.max(observed, claimed) * 1.5)
}
/** Editorial order inside a band: evidence-weighted depth first, then interest, a little freshness, less if the price has not moved. */
export function rankValue(d: Deal, now: Date): number {
  const age = (now.getTime() - Date.parse(d.publishedAt)) / 86400000
  const fresh = Number.isFinite(age) ? 10 * Math.exp(-Math.max(0, age) / 2) : 0
  const h = d.history
  const flat = h && h.days >= 7 && Math.abs(h.maxPrice - h.minPrice) <= d.price * .02 ? 20 : 0
  // v5 (2026-11-15): depth leads. Evidence-weighted depth outweighs interest, and the raw figure adds a little on top.
  return (d.interest || 0) * .4 + evidenceOf(d) * .6 + depthFor(d) * .15 + fresh - flat - (isCatalog(d) ? 10 : 0) - (/amazon\./i.test(d.storeDomain || d.store) && d.source === 'Techbargains' && !soldByAmazon(d) ? 15 : 0)
}
const MAX_PER_STORE = 12
/** No store or category may wall off the page: small stores are capped, no store runs three in a row, no category twice in a row and no brand twice within four rows while another is waiting nearby. */
export function diversify(deals: Deal[]): Deal[] {
  const count = new Map<string, number>(), kept: Deal[] = [], over: Deal[] = []
  for (const d of deals) {
    const n = count.get(d.store) || 0
    if (d.store !== 'Amazon' && n >= MAX_PER_STORE) { over.push(d); continue }
    count.set(d.store, n + 1); kept.push(d)
  }
  const out: Deal[] = []
  while (kept.length) {
    const a = out.at(-1), b = out.at(-2)
    const store = a && b && a.store === b.store ? a.store : null
    const category = a?.category ?? null
    const near = kept.slice(0, 40)
    // Category variety looks a shorter way ahead than the store rule, so a strong row is never pushed far down.
    const brands = new Set(out.slice(-3).map(d => d.brand).filter(Boolean))
    let i = near.slice(0, 24).findIndex(d => d.store !== store && d.category !== category && !(d.brand && brands.has(d.brand)))
    if (i < 0) i = near.slice(0, 24).findIndex(d => d.store !== store && d.category !== category)
    if (i < 0) i = store ? near.findIndex(d => d.store !== store) : 0
    if (i < 0) i = 0
    out.push(kept.splice(i, 1)[0]!)
  }
  return [...out, ...over]
}
export function interestOf(d: Deal): Pick<Deal, 'interest' | 'interestSignals'> {
  let interest = 0
  const interestSignals: string[] = []
  const add = (n: number, text: string) => { interest += n; interestSignals.push(text) }
  const tier = tierOf(d)
  if (tier) add(tier === 1 ? 30 : 20, 'Marca reconocida')
  if (TECHNICAL.includes(d.category || '')) add(25, 'Categoría de interés técnico')
  else if (DURABLE.includes(d.category || '')) add(15, 'Producto de uso duradero')
  // v5 (2026-11-15): a real cut is itself a reason to look. An observed price counts in full, a seller's list far less.
  const observed = observedDepth(d)
  if (observed >= 50) add(25, 'Al menos 50 % bajo un precio observado')
  else if (observed >= 30) add(15, 'Al menos 30 % bajo un precio observado')
  else if (depthFor(d) >= 50) add(10, 'Rebaja declarada de al menos 50 %')
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
  if (d.source === 'CamelCamelCamel') return 24
  if (isGame(d) || isCatalog(d)) return Infinity
  if (/amazon\./i.test(d.storeDomain || d.store)) return soldByAmazon(d) ? 96 : 24
  return d.source === 'DealNews' ? 72 : 48
}
export function rejection(d: Deal, now?: Date): RejectReason | undefined {
  if (now && (now.getTime() - Date.parse(d.publishedAt)) / 3600000 > maxAgeHours(d)) return 'stale-price'
  if (roundup(d.title) || (d.ai?.verdict === 'noise' && d.ai.confidence >= .7)) return 'low-value'
  if (!isGame(d) && tradeItem(d.title)) return 'not-consumer'
  if (unvetted(d)) return 'unvetted-drop'
  if (!isGame(d) && d.errorScore >= 40) return undefined
  if (isGame(d)) return undefined
  const soft = SOFT[d.category || '']
  if (soft && !(depthFor(d) >= SOFT_MIN_DEPTH && (tierOf(d) || d.staffPick || (d.seenIn?.length || 0) >= 2))) return soft
  if (/\b(?:christmas|halloween|holiday decor|inflatable.*(?:santa|tree)|ornaments?|pajamas?)\b/i.test(d.title)) return 'seasonal-decor'
  if (/\b(?:gift cards?|gift certificates?)\b/i.test(d.title)) return 'gift-card'
  if (/\b(?:gaskets?|pressure switch|ignition switch|inlet valve|door seal|replacement (?:part|filter|belt|hose|brush|pads?|bags?)|control board|(?:water-?level|temperature|oxygen|O2) sensor|vent hood|recommended accessory|spool holders?|(?<![\w-])\d{8,10}(?![\w-])|brush roller|side brush(?:es)?|dust bags?|mop pads?|filter (?:set|pack|kit)|accessor(?:y|ies) kit|oem part|[A-Z]{2}\d{2}-\d{5}[A-Z]?)\b/i.test(d.title)) return 'replacement-part'
  if (isCatalog(d) && !catalogDiscount(d)) return 'catalog-price'
  if (!tierOf(d) && (d.reference?.kind === 'list' || !d.reference) && (d.discountPct || 0) >= 70) return 'noname-inflated'
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
  // A brand store's whole sale would otherwise fill the page: its deepest cuts stay, the rest wait.
  const byStore = new Map<string, Deal[]>()
  for (const d of kept) if (isCatalog(d) && d.errorScore < 40) byStore.set(d.store, [...(byStore.get(d.store) || []), d])
  const capped = new Set<string>()
  for (const list of byStore.values()) for (const d of list.sort((a, b) => depthFor(b) - depthFor(a) || a.id.localeCompare(b.id)).slice(CATALOG_PER_STORE)) capped.add(d.id)
  if (capped.size) { gate.rejected += capped.size; gate.byReason['store-cap'] = capped.size }
  const published = kept.filter(d => !capped.has(d.id))
  gate.published = published.length
  return { kept: published, gate }
}
