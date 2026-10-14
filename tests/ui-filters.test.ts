import { describe, expect, it } from 'vitest'
import { applyFilters, filterOptions, filtersFromQuery, hasFilters, tally } from '../app/utils/filters'
import type { DealView } from '../app/composables/useDeals'

const deal = (id: string, patch: Partial<DealView> = {}): DealView => ({
  id, title: id, store: 'Amazon', category: 'hogar', currency: 'USD', price: 20,
  listPrice: 100, discountPct: 80, score: 50, errorScore: 0, errorSignals: [],
  flag: 'chollo', publishedAt: '2026-10-14T10:00:00Z', direct: true,
  url: 'https://example.com/offer', storeUrl: null, storeDomain: null,
  source: 'DealNews', sourceUrl: 'https://example.com/source', image: null, reasons: [], ...patch,
})
const history = { days: 2, minPrice: 100, maxPrice: 100, firstSeen: '2026-10-12' }
const deals = [deal('game', { category: 'videojuegos', store: 'Steam' }), deal('cheap'), deal('old', { price: 200, history, flag: 'normal', discountPct: 20, direct: false })]
const ids = (items: DealView[]) => items.map(d => d.id)

describe('UI filters', () => {
  it('hides games by default while preserving file order', () => {
    expect(ids(applyFilters(deals))).toEqual(['cheap', 'old'])
    expect(ids(applyFilters(deals, filtersFromQuery({ juegos: '1' })))).toEqual(['game', 'cheap', 'old'])
    expect(ids(applyFilters(deals, filtersFromQuery({ cat: 'videojuegos' })))).toEqual(['game'])
    expect(ids(applyFilters(deals, { hideGames: false }))).toEqual(['game', 'cheap', 'old'])
  })
  it('applies inclusive price limits only to USD/EUR/GBP without conversion', () => {
    const items = ['USD', 'EUR', 'GBP', 'JPY'].flatMap(currency => [deal(currency + '25', { currency, price: 25 }), deal(currency + '26', { currency, price: 26 })])
    expect(ids(applyFilters(items, { max: 25 }))).toEqual(['USD25', 'EUR25', 'GBP25', 'JPY25', 'JPY26'])
    expect(ids(applyFilters([deal('free', { price: 0 }), deal('paid')], filtersFromQuery({ max: '0' })))).toEqual(['free'])
  })
  it('defines new as no history, independently of publication time', () => {
    expect(ids(applyFilters(deals, filtersFromQuery({ nuevas: '1' })))).toEqual(['cheap'])
    expect(applyFilters([deal('earlier', { publishedAt: '2025-01-01T00:00:00Z' })], { fresh: true })).toHaveLength(1)
  })
  it('preserves aliases and combines existing keys', () => {
    for (const tipo of ['baratisimo', 'chollo']) expect(ids(applyFilters(deals, filtersFromQuery({ tipo, tienda: 'Amazon', cat: 'hogar', min: '75', q: 'CHEAP', directas: '1', vista: 'lista' })))).toEqual(['cheap'])
    expect(filtersFromQuery({ tipo: 'posible-error' }).flag).toBe('error-probable')
    expect(filtersFromQuery({ tipo: 'error-probable' }).flag).toBe('error-probable')
  })
  it('rejects invalid ceilings and safely parses repeated query keys', () => {
    for (const max of ['', '-1', 'Infinity', 'oops']) expect(filtersFromQuery({ max }).max).toBeNull()
    expect(filtersFromQuery({ juegos: ['1', '0'], orden: 'invalid' })).toMatchObject({ games: true, sort: 'destacadas' })
    expect(hasFilters(filtersFromQuery())).toBe(false)
    expect(hasFilters(filtersFromQuery({ max: '0' }))).toBe(true)
  })
  it('sorts explicitly without mutating the input', () => {
    const items = [deal('a', { score: 1, errorScore: 90, discountPct: 10 }), deal('b', { score: 90, errorScore: 40, discountPct: 90, publishedAt: '2026-10-14T11:00:00Z' })]
    for (const sort of ['puntuacion', 'descuento', 'recientes'] as const) expect(ids(applyFilters(items, { sort }))).toEqual(['b', 'a'])
    expect(ids(applyFilters(items, { sort: 'sospecha' }))).toEqual(['a', 'b'])
    expect(ids(items)).toEqual(['a', 'b'])
  })
  it('offers only populated, narrowing price, discount, flag and boolean choices', () => {
    const o = filterOptions(deals, filtersFromQuery())
    expect(o.maxes).toEqual([25, 50, 100])
    expect(o.mins).toEqual([0, 25, 50, 75])
    expect(o.flags.map(f => f.flag)).toEqual(['chollo'])
    expect(o.showFresh).toBe(true)
    expect(o.showDirect).toBe(true)
    expect(o.gamesCount).toBe(1)
    expect(o.stores).toEqual([['Amazon', 2]])
    expect(o.categories).toContainEqual(['videojuegos', 1])
    const uniform = filterOptions([deal('only')], filtersFromQuery())
    expect(uniform.maxes).toEqual([])
    expect(uniform.mins).toEqual([0])
    expect(uniform.flags).toEqual([])
    expect(uniform.showFresh).toBe(false)
    expect(uniform.showDirect).toBe(false)
    expect(filterOptions([deal('foreign', { currency: 'JPY' })], filtersFromQuery()).maxes).toEqual([])
  })
  it('facets respect other selections and ignore their own selection', () => {
    const o = filterOptions(deals, filtersFromQuery({ max: '50' }))
    expect(o.maxes).toEqual([25, 50, 100])
    expect(o.stores).toEqual([['Amazon', 1]])
    expect(o.showFresh).toBe(false)
    expect(filterOptions(deals, filtersFromQuery({ q: 'missing' })).categories).toEqual([])
    expect(tally([null, '', ' ', 'A', 'A'])).toEqual([['A', 2]])
    expect(filterOptions([], filtersFromQuery()).maxes).toEqual([])
  })
})
