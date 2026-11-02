import type { Deal, PriceLedger } from './types.ts'
import { productKey, strongModel, brandOf } from './identity.ts'
export interface CuratedPrice { titleRegex: string; kind: 'msrp' | 'spec-floor'; currency: 'USD'; price: number; asOf: string; source: string }
export function median(values: number[]): number {
  const sorted = [...values].sort((a,b) => a-b), mid = Math.floor(sorted.length/2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid-1]! + sorted[mid]!)/2
}
export function resolveReference(d: Deal, offers: Deal[], ledger: PriceLedger, curated: CuratedPrice[], now: Date): Deal['reference'] {
  const today = now.toISOString().slice(0,10), key = productKey(d)
  const entry = ledger.products[key]
  const rows = entry?.currency === d.currency && (!key.startsWith('shopify:') || entry.title === d.title) ? entry.series.filter(r => r.d < today && r.p > 0) : []
  if (rows.length >= 3) return { price: median(rows.map(r => r.p)), kind: 'ledger', observations: rows.length, asOf: rows.at(-1)!.d, note: 'Mediana de ' + rows.length + ' días observados (sin hoy)' }
  const model = strongModel(d.title)
  const stores = new Map<string, number>()
  for (const other of offers) {
    const store = (other.storeDomain || other.store).toLowerCase().replace(/^www\./,'')
    const own = (d.storeDomain || d.store).toLowerCase().replace(/^www\./,'')
    if (other.currency !== d.currency || store === own || !(other.price > 0)) continue
    if ((other.productKey || productKey(other)) !== key && !(model && model === strongModel(other.title) && brandOf(d.title) && brandOf(d.title) === brandOf(other.title))) continue
    stores.set(store, Math.min(stores.get(store) ?? Infinity, other.price))
  }
  if (stores.size) return { price: median([...stores.values()]), kind: 'cross-store', observations: stores.size, asOf: today, note: 'Precio en ' + stores.size + ' comercios distintos' }
  const match = curated.filter(c => c.currency === d.currency && c.asOf <= today && c.price > 0 && new RegExp(c.titleRegex, 'i').test(d.title)).sort((a,b) => a.price-b.price)[0]
  if (match) return { price: match.price, kind: 'curated', asOf: match.asOf, note: (match.kind === 'spec-floor' ? 'Suelo conservador por especificaciones' : 'MSRP documentado') + ': ' + match.source }
  if (d.reference?.kind === 'source-previous' && d.reference.price > 0) return d.reference
  if (d.listPrice && d.listPrice > 0) return { price: d.listPrice, kind: 'list', note: 'Precio de lista declarado por el vendedor' }
  return undefined
}
