import { describe, expect, it } from 'vitest'
import { applyGate, CATALOG_PER_STORE, diversify, interestOf } from '../lib/interest'
import { categorize } from '../lib/categorize'
import { normalizeSource } from '../lib/normalize'
import { depthTier, pctClass } from '../app/utils/deal'
import { deal } from './helpers'

// v5 (2026-11-15): the general index. More departments, depth counted as interest,
// brand stores read sale rows only, and the percentage tag coloured by depth.
const now = new Date('2026-11-15T12:00:00Z')
const direct = (o: Parameters<typeof deal>[0] = {}) => deal({ storeUrl: 'https://shop.test/item/100', storeDomain: 'shop.test', direct: true, price: 60, listPrice: 120, discountPct: 50, ...o })

describe('v5 categories', () => {
  it('files the new departments before the broad rules they were carved from', () => {
    for (const [title, category] of [
      ['Ergonomic Office Chair with lumbar support', 'oficina'], ['4K Dash Cam with night vision', 'motor'],
      ['7-Night Caribbean Cruise from $499', 'viajes'], ['Purina Pro Plan dog food 30 lb', 'mascotas'],
      ['Graco convertible stroller', 'bebes'], ['Queen memory foam mattress', 'muebles'],
      ['Fender Player Stratocaster', 'ocio'], ['Vitamin D3 gummies 120 ct', 'salud'], ['Steel fire pit for the patio', 'jardin'],
    ] as const) expect(categorize(title, null, 'Shop')).toBe(category)
  })
  it('falls back to the maker only when no product word matched', () => {
    expect(categorize('JBL Authentics 200 - Retro Sty...matic self tuning', null, 'Amazon')).toBe('electronica')
    expect(categorize('Sony stroller fan', null, 'Amazon')).toBe('bebes')
  })
})

describe('v5 gate', () => {
  it('lets clothing in only with a known brand and a deep cut', () => {
    const nike = direct({ id: 'n', title: 'Nike Pegasus running shoes', category: 'ropa' })
    expect(applyGate([nike]).kept).toHaveLength(1)
    expect(applyGate([{ ...nike, discountPct: 20, listPrice: 75 }]).gate.byReason.apparel).toBe(1)
    expect(applyGate([{ ...nike, title: 'Fleece lined thermal tights' }]).gate.byReason.apparel).toBe(1)
  })
  it('counts an observed cut as interest in full and a list claim for less', () => {
    const base = deal({ category: 'hogar', price: 50, listPrice: null, discountPct: null })
    const observed = interestOf({ ...base, reference: { price: 100, kind: 'ledger', note: 'x' }, referenceDiscountPct: 50 })
    expect(observed.interest).toBe(50)
    expect(observed.interestSignals).toContain('Al menos 50 % bajo un precio observado')
    expect(interestOf({ ...base, reference: { price: 100, kind: 'list', note: 'x' }, referenceDiscountPct: 50 }).interest).toBe(35)
  })
  it("keeps a brand store's deepest cuts and holds the rest back", () => {
    const rows = Array.from({ length: 9 }, (_, i) => direct({
      id: 'c' + i, title: `Pan number ${i} size ${i}`, store: 'Our Place', category: 'cocina', price: 40 + i, listPrice: 100, discountPct: 60 - i,
      url: 'https://shop.test/p/' + i, storeUrl: 'https://shop.test/p/' + i, sourceUrl: 'https://shop.test/p/' + i,
    }))
    const { kept, gate } = applyGate(rows)
    expect(kept).toHaveLength(CATALOG_PER_STORE)
    expect(gate.byReason['store-cap']).toBe(9 - CATALOG_PER_STORE)
    expect(Math.min(...kept.map(d => d.discountPct!))).toBe(60 - (CATALOG_PER_STORE - 1))
    expect(gate.considered).toBe(gate.published + gate.rejected)
  })
  it('alternates categories while another is waiting', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => deal({ id: 'e' + i, store: 'S' + i, category: 'electronica' })),
      ...Array.from({ length: 3 }, (_, i) => deal({ id: 'k' + i, store: 'K' + i, category: 'cocina' })),
    ]
    const out = diversify(rows)
    expect(out).toHaveLength(rows.length)
    expect(out.slice(0, 6).map(d => d.category)).toEqual(['electronica', 'cocina', 'electronica', 'cocina', 'electronica', 'cocina'])
  })
})

describe('v5 brand stores', () => {
  it('reads only marked-down rows, files them under the store category and dates them from first sight', () => {
    const product = (handle: string, price: string, compare: string | null) => ({
      title: 'Always ' + handle, handle, product_type: '', published_at: '2020-01-01T00:00:00Z', images: [],
      variants: [{ id: 1, title: 'Default Title', available: true, price, compare_at_price: compare }],
    })
    const raw = JSON.stringify({ products: [product('pan', '50.00', '100.00'), product('pot', '80.00', null), product('lid', '20.00', '20.00')] })
    const out = normalizeSource({ name: 'Our Place', kind: 'shopify', direct: true, url: 'https://fromourplace.com/products.json?limit=250', category: 'cocina', onlyCategory: true, saleOnly: true }, raw, now)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ title: 'Always pan', price: 50, listPrice: 100, category: 'cocina', direct: true, publishedAt: now.toISOString() })
  })
})

describe('v5 percentage tag', () => {
  it('tiers the depth at 30, 50 and 70', () => {
    expect([29, 30, 49, 50, 69, 70, 100].map(depthTier)).toEqual([1, 2, 2, 3, 3, 4, 4])
  })
  it('fills the tag for an observed price and outlines it for a list claim', () => {
    expect(pctClass({ reference: { price: 100, kind: 'ledger', note: 'x' }, referenceDiscountPct: 72 })).toBe('pct--t4')
    expect(pctClass({ reference: { price: 100, kind: 'list', note: 'x' }, referenceDiscountPct: 55 })).toBe('pct--t3 pct--claim')
    expect(pctClass({ discountPct: 35 })).toBe('pct--t2 pct--claim')
  })
})
