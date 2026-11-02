// UI filter tests for the v3 keys. Next to the code because tests/ belongs to the
// pipeline; the repo's vitest include is tests/**, so this needs a config that includes it.
import { describe, expect, it } from 'vitest'
import type { DealView } from '../app/composables/useDeals'
import { activeItems, applyFilters, filterOptions, filtersFromQuery, hasFilters, sortValue } from '../app/utils/filters'
import { byEvidence, depthOf, evidenceLine, gateReasonLabel, gateSummary, historyRange, normalizeGate, normalizeReference, strengthOf } from '../app/utils/deal'

const deal = (id: string, patch: Partial<DealView> = {}): DealView => ({
  id, title: id, store: 'Amazon', category: 'hogar', currency: 'USD', price: 20,
  listPrice: null, discountPct: null, score: 50, errorScore: 0, errorSignals: [],
  flag: 'normal', publishedAt: '2026-11-02T10:00:00Z', direct: true,
  url: 'https://example.com/offer', storeUrl: null, storeDomain: null,
  source: 'DealNews', sourceUrl: 'https://example.com/source', image: null, reasons: [], ...patch,
})
const ledger = { price: 100, kind: 'ledger' as const, observations: 14, note: 'Mediana de 14 días observados' }
const list = { price: 100, kind: 'list' as const, note: 'x' }
const ids = (items: DealView[]) => items.map(d => d.id)

describe('direct default', () => {
  const deals = [deal('a'), deal('b', { direct: false })]
  it('shows direct only when the page defaults to it, and counts as no filter', () => {
    const s = filtersFromQuery({}, true, true)
    expect(ids(applyFilters(deals, s))).toEqual(['a'])
    expect(hasFilters(s)).toBe(false)
    expect(filterOptions(deals, s).middlemanCount).toBe(1)
  })
  it('one key includes middlemen, as a removable item', () => {
    const s = filtersFromQuery({ intermediarios: '1' }, true, true)
    expect(ids(applyFilters(deals, s))).toEqual(['a', 'b'])
    expect(activeItems(s).map(i => i.id)).toEqual(['intermediarios'])
  })
  it('old directas=1 still narrows on pages without the default', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ directas: '1' })))).toEqual(['a'])
    expect(ids(applyFilters(deals, filtersFromQuery({})))).toEqual(['a', 'b'])
  })
})

describe('multi-value and range keys', () => {
  const deals = [
    deal('asus', { brand: 'ASUS', store: 'Amazon', price: 900 }),
    deal('msi', { brand: 'MSI', store: 'Newegg', price: 500 }),
    deal('anon', { brand: null, store: 'Newegg', price: 50 }),
  ]
  it('accepts repeated and single store and brand keys', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ tienda: ['Amazon', 'Newegg'] })))).toEqual(['asus', 'msi', 'anon'])
    expect(ids(applyFilters(deals, filtersFromQuery({ tienda: 'Newegg' })))).toEqual(['msi', 'anon'])
    expect(ids(applyFilters(deals, filtersFromQuery({ marca: ['ASUS', 'MSI'] })))).toEqual(['asus', 'msi'])
  })
  it('searches title and brand, without accents', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ q: 'asús' })))).toEqual(['asus'])
  })
  it('applies min and max, ignoring junk', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ desde: '100', max: '600' })))).toEqual(['msi'])
    for (const desde of ['', '-1', 'oops', '0']) expect(filtersFromQuery({ desde }).priceMin).toBeNull()
  })
  it('facet counts respect other selections, ignore their own, and keep the selected', () => {
    const o = filterOptions(deals, filtersFromQuery({ tienda: 'Amazon' }))
    expect(o.brands).toEqual([['ASUS', 1]])
    expect(o.stores).toEqual([['Newegg', 2], ['Amazon', 1]])
    const none = filterOptions(deals, filtersFromQuery({ tienda: 'Amazon', marca: 'MSI' }))
    expect(none.stores).toEqual([['Newegg', 1], ['Amazon', 0]])
    expect(none.brands).toContainEqual(['MSI', 0])
  })
  it('removing one store keeps the others', () => {
    const items = activeItems(filtersFromQuery({ tienda: ['A', 'B'] }))
    expect(items.find(i => i.id === 'tienda:A')?.patch).toEqual({ tienda: ['B'] })
  })
})

describe('evidence, interest, error', () => {
  const deals = [
    deal('observed', { reference: ledger, referenceDiscountPct: 60, errorScore: 80, interest: 90 }),
    deal('claim', { reference: list, referenceDiscountPct: 85, errorScore: 60, interest: 30 }),
    deal('bare', { errorScore: 41 }),
  ]
  it('filters by kind, including no reference', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ evidencia: 'ledger' })))).toEqual(['observed'])
    expect(ids(applyFilters(deals, filtersFromQuery({ evidencia: ['list', 'ninguna'] })))).toEqual(['claim', 'bare'])
    expect(filtersFromQuery({ evidencia: 'bogus' }).evidence).toEqual([])
  })
  it('min is depth against the reference', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ min: '70' })))).toEqual(['claim'])
  })
  it('filters interest and error level', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ interes: '50' })))).toEqual(['observed'])
    expect(ids(applyFilters(deals, filtersFromQuery({ error: '55' })))).toEqual(['observed', 'claim'])
  })
  it('offers only populated kinds', () => {
    expect(filterOptions(deals, filtersFromQuery()).evidence.map(e => e.key)).toEqual(['ledger', 'list', 'ninguna'])
    expect(filterOptions([deal('x')], filtersFromQuery()).interests).toEqual([])
    expect(filterOptions([deal('x')], filtersFromQuery()).errorLevels).toEqual([])
  })
  it('ranks evidence before score: a claim never outranks an observation', () => {
    expect(byEvidence([deal('c', { reference: list, errorScore: 69 }), deal('o', { reference: ledger, errorScore: 45 })]).map(d => d.id)).toEqual(['o', 'c'])
  })
  it('staff pick and corroboration are separate keys', () => {
    const items = [deal('s', { staffPick: true }), deal('c', { seenIn: ['A', 'B'] }), deal('n', { seenIn: ['A'] })]
    expect(ids(applyFilters(items, filtersFromQuery({ elegida: '1' })))).toEqual(['s'])
    expect(ids(applyFilters(items, filtersFromQuery({ corroborada: '1' })))).toEqual(['c'])
  })
})

describe('sorting', () => {
  const items = [
    deal('cheap', { price: 5, reference: { ...ledger, price: 200 }, referenceDiscountPct: 97, interest: 10, brand: 'Zed' }),
    deal('dear', { price: 900, reference: { ...list, price: 1000 }, referenceDiscountPct: 10, interest: 90, brand: 'Acer' }),
    deal('none', { price: 50, brand: null }),
  ]
  it('sorts each way with missing values last in both directions', () => {
    expect(ids(applyFilters(items, filtersFromQuery({ orden: 'precio' })))).toEqual(['cheap', 'none', 'dear'])
    expect(ids(applyFilters(items, filtersFromQuery({ orden: 'precio', dir: 'desc' })))).toEqual(['dear', 'none', 'cheap'])
    expect(ids(applyFilters(items, filtersFromQuery({ orden: 'profundidad' })))).toEqual(['cheap', 'dear', 'none'])
    expect(ids(applyFilters(items, filtersFromQuery({ orden: 'profundidad', dir: 'asc' })))).toEqual(['dear', 'cheap', 'none'])
    expect(ids(applyFilters(items, filtersFromQuery({ orden: 'interes' })))).toEqual(['dear', 'cheap', 'none'])
    expect(ids(applyFilters(items, filtersFromQuery({ orden: 'marca' })))).toEqual(['dear', 'cheap', 'none'])
  })
  it('encodes a non-default direction only', () => {
    expect(sortValue({ sort: 'precio', dir: null })).toBe('precio')
    expect(sortValue({ sort: 'precio', dir: 'asc' })).toBe('precio')
    expect(sortValue({ sort: 'precio', dir: 'desc' })).toBe('precio:desc')
  })
  it('old view and sort keys keep working', () => {
    expect(filtersFromQuery({ vista: 'lista' }).view).toBe('tabla')
    expect(filtersFromQuery({ vista: 'cuadricula' }).view).toBe('cuadricula')
    expect(filtersFromQuery({}).view).toBe('tabla')
    expect(filtersFromQuery({ orden: 'puntuacion' }).sort).toBe('puntuacion')
  })
})

describe('normalizing old and odd files', () => {
  const base = { price: 20, listPrice: null, discountPct: null }
  it('a v2 list price becomes the weakest reference, plainly worded', () => {
    const r = normalizeReference({ ...base, listPrice: 100, discountPct: 80 })
    expect(r.reference?.kind).toBe('list')
    expect(r.reference?.note).toBe('Precio de lista del vendedor, sin verificar')
    expect(r.referenceDiscountPct).toBe(80)
  })
  it('no list price means no reference, never an invented one', () => {
    expect(normalizeReference(base)).toEqual({ referenceDiscountPct: null })
    expect(normalizeReference({ ...base, listPrice: 10 })).toEqual({ referenceDiscountPct: null })
  })
  it('keeps a v3 note, computes missing depth, rejects garbage', () => {
    const r = normalizeReference({ ...base, reference: ledger })
    expect(r.reference?.note).toBe('Mediana de 14 días observados')
    expect(r.referenceDiscountPct).toBe(80)
    expect(normalizeReference({ ...base, reference: { price: NaN, kind: 'ledger', note: '' } }).reference).toBeUndefined()
  })
  it('an unknown kind from a future pipeline counts as the weakest', () => {
    const r = normalizeReference({ ...base, reference: { price: 100, kind: 'oracle' as never, note: 'trust me' } })
    expect(r.reference?.kind).toBe('list')
    expect(strengthOf(r)).toBe('debil')
  })
  it('a list reference always reads the fixed words, whatever the file says', () => {
    expect(normalizeReference({ ...base, reference: { price: 100, kind: 'list', note: 'Precio real garantizado' } }).reference?.note).toBe('Precio de lista del vendedor, sin verificar')
  })
  it('a source-previous reference reads as a report, naming the reporter', () => {
    const note = (n: string, source?: string) => normalizeReference({ ...base, source, reference: { price: 100, kind: 'source-previous', note: n } }).reference?.note
    expect(note('Precio anterior comunicado por CamelCamelCamel')).toBe('Precio anterior según CamelCamelCamel')
    expect(note('Precio anterior según Keepa')).toBe('Precio anterior según Keepa')
    expect(note('', 'CamelCamelCamel')).toBe('Precio anterior según CamelCamelCamel')
    expect(note('')).toBe('Precio anterior según la fuente')
  })
  it('source-previous ranks below the ledger and above a list claim', () => {
    const order = byEvidence([
      deal('list', { reference: list, errorScore: 90 }),
      deal('reported', { reference: { price: 100, kind: 'source-previous', note: 'x' }, errorScore: 50 }),
      deal('ledger', { reference: ledger, errorScore: 40 }),
    ])
    expect(order.map(d => d.id)).toEqual(['ledger', 'reported', 'list'])
  })
  it('dates curated evidence only', () => {
    expect(evidenceLine({ price: 1, kind: 'curated', asOf: '2026-10-03', note: 'MSRP' })).toMatch(/^MSRP \(3 oct/)
    expect(evidenceLine({ price: 1, kind: 'ledger', asOf: '2026-10-03', note: 'Mediana' })).toBe('Mediana')
    expect(evidenceLine(undefined)).toBe('Sin referencia de precio')
  })
  it('depth falls back to the declared discount', () => {
    expect(depthOf({ discountPct: 30 })).toBe(30)
    expect(depthOf({ referenceDiscountPct: 10, discountPct: 30 })).toBe(10)
  })
  it('gate labels and shape', () => {
    expect(gateReasonLabel('noname-inflated')).toBe('precio de lista inflado')
    expect(gateReasonLabel('something-new')).toBe('something-new')
    expect(normalizeGate(undefined)).toBeNull()
    expect(normalizeGate({ considered: 'x' })).toBeNull()
    expect(normalizeGate({ considered: 9, published: 4, rejected: 5, byReason: { food: 5, bad: -1 } })?.byReason).toEqual({ food: 5 })
  })
  it('the publication cap is not a quality rejection', () => {
    expect(gateReasonLabel('catalog-price')).toBe('precio de catálogo, sin rebaja real')
    expect(gateReasonLabel('publication-cap')).toBe('fuera del tope de publicación')
    expect(gateReasonLabel('replacement-part')).toBe('repuestos')
    expect(gateReasonLabel('variant-duplicate')).toBe('variantes de la misma oferta')
    const s = gateSummary({ considered: 100, published: 40, rejected: 60, byReason: { 'publication-cap': 25, 'catalog-price': 20, food: 15 } })
    expect(s.quality).toBe(35)
    expect(s.capped).toBe(25)
    expect(s.reasons.map(r => r.slug)).toEqual(['catalog-price', 'food'])
  })
  it('history draws a range only when there is one, and from real numbers', () => {
    expect(historyRange(undefined, 10, 'USD')).toBeNull()
    expect(historyRange({ days: 0, minPrice: 5, maxPrice: 9 }, 7, 'USD')).toBeNull()
    expect(historyRange({ days: 3, minPrice: 10, maxPrice: 10 }, 10, 'USD')).toBeNull()
    expect(historyRange({ days: 3, minPrice: 10, maxPrice: 20 }, 15, 'USD')?.position).toBe(0.5)
    expect(historyRange({ days: 3, minPrice: 10, maxPrice: 20 }, 5, 'USD')?.position).toBe(0)
  })
})
