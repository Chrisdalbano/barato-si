import type { Deal, PriceLedger } from './types.ts'
import { productKey } from './identity.ts'
import { categorize } from './categorize.ts'

export const LEDGER_LIMIT = 3_000_000
export const emptyLedger = (now: Date): PriceLedger => ({ version: 1, updatedAt: now.toISOString(), products: {} })
export function pruneLedger(ledger: PriceLedger, now: Date, maxBytes = LEDGER_LIMIT): PriceLedger {
  const today = now.toISOString().slice(0, 10)
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 119 * 86400000).toISOString().slice(0, 10)
  const products: PriceLedger['products'] = {}
  for (const [key, value] of Object.entries(ledger.products)) {
    const days = new Map<string, { d: string; p: number; s: string }>()
    for (const row of value.series) if (row.d >= cutoff && row.d <= today && Number.isFinite(row.p) && row.p >= 0) {
      if (!days.has(row.d) || days.get(row.d)!.p > row.p) days.set(row.d, { ...row })
    }
    const series = [...days.values()].sort((a,b) => a.d.localeCompare(b.d))
    if (series.length) products[key] = { ...value, series }
  }
  const result: PriceLedger = { version: 1, updatedAt: now.toISOString(), products }
  const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length
  let bytes = size(result) + 2
  const sizes = new Map(Object.entries(products).map(([k,v]) => [k, size(k) + 1 + size(v) + 1]))
  // Re-evaluate the largest serialized entry after each removal. Deterministic ties.
  while (bytes > maxBytes && sizes.size) {
    const key = [...sizes.keys()].sort((a,b) => sizes.get(b)! - sizes.get(a)! || a.localeCompare(b))[0]!
    const before = sizes.get(key)!
    products[key]!.series.shift()
    if (!products[key]!.series.length) { delete products[key]; sizes.delete(key); bytes -= before }
    else { const after = size(key) + 1 + size(products[key]) + 1; sizes.set(key, after); bytes += after - before }
  }
  return result
}
export function mergeLedger(ledger: PriceLedger, offers: Deal[], now: Date): PriceLedger {
  const next: PriceLedger = { ...ledger, products: Object.fromEntries(Object.entries(ledger.products).map(([k,v]) => [k, { ...v, series: v.series.map(r => ({ ...r })) }])) }
  const day = now.toISOString().slice(0, 10)
  for (const d of offers) {
    if (categorize(d.title, d.category, d.store) === 'videojuegos' || !Number.isFinite(d.price) || d.price < 0) continue
    const key = productKey(d)
    let existing: PriceLedger['products'][string] | undefined = next.products[key]
    // A Shopify handle can switch its cheapest available configuration. Reset rather than compare unlike variants.
    if (existing && key.startsWith('shopify:') && existing.title !== d.title) { delete next.products[key]; existing = undefined }
    // Contract has one currency per product: never mix monetary units.
    if (existing && existing.currency !== d.currency) continue
    const entry = existing || (next.products[key] = { title: d.title, currency: d.currency, firstSeen: day, series: [] })
    entry.firstSeen = entry.firstSeen < day ? entry.firstSeen : day
    const row = entry.series.find(r => r.d === day)
    if (!row) entry.series.push({ d: day, p: d.price, s: d.source })
    else if (d.price < row.p) { row.p = d.price; row.s = d.source }
  }
  return pruneLedger(next, now)
}
export function seedLedger(archives: { date: string; deals: Deal[] }[], now: Date): PriceLedger {
  let ledger = emptyLedger(now)
  for (const file of [...archives].sort((a,b) => a.date.localeCompare(b.date))) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(file.date) && file.date < now.toISOString().slice(0,10)) ledger = mergeLedger(ledger, file.deals, new Date(file.date + 'T00:00:00Z'))
  }
  return pruneLedger(ledger, now)
}
export function ledgerHistory(d: Deal, ledger: PriceLedger, now: Date): Deal['history'] {
  const entry = ledger.products[productKey(d)]
  if (!entry || entry.currency !== d.currency || (productKey(d).startsWith('shopify:') && entry.title !== d.title)) return undefined
  const rows = entry.series.filter(r => r.d < now.toISOString().slice(0, 10))
  if (!rows.length) return undefined
  return { days: rows.length, minPrice: Math.min(...rows.map(r => r.p)), maxPrice: Math.max(...rows.map(r => r.p)), firstSeen: entry.firstSeen }
}
