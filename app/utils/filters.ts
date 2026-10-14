import type { DealView } from '../composables/useDeals'
import { categoryLabel } from './deal'
import { FLAG_QUERY, FLAG_LABEL, flagFromQuery } from './format'

export type SortKey = 'destacadas' | 'puntuacion' | 'descuento' | 'sospecha' | 'recientes'
export type ViewKey = 'cuadricula' | 'lista'
export const SORTS: { key: SortKey; label: string }[] = [
  // Default: the file's own order (balanced across sources by the pipeline).
  { key: 'destacadas', label: 'Destacadas' },
  { key: 'puntuacion', label: 'Puntuación' },
  { key: 'descuento', label: 'Descuento' },
  // Price-error likelihood (errorScore). Offered only when some deal has one.
  { key: 'sospecha', label: 'Sospecha' },
  { key: 'recientes', label: 'Recientes' },
]
export const MIN_DISCOUNTS = [0, 25, 50, 75]

export const PRICE_BUCKETS = [25, 50, 100, 250, 500, 1000]
const PRICE_CURRENCIES = new Set(['USD', 'EUR', 'GBP'])
export interface FilterState {
  flag: string; store: string; category: string; min: number; text: string
  direct: boolean; games: boolean; fresh: boolean; max: number | null
  sort: SortKey; view: ViewKey; hideGames: boolean
}
type Query = Record<string, string | null | (string | null)[] | undefined>
const one = (v: Query[string]): string => (Array.isArray(v) ? v[0] : v) ?? ''
export function filtersFromQuery(query: Query = {}, hideGames = true): FilterState {
  const max = one(query.max).trim()
  const sort = one(query.orden)
  return {
    flag: flagFromQuery(one(query.tipo)), store: one(query.tienda), category: one(query.cat),
    min: Math.max(0, Math.min(99, Number(one(query.min)) || 0)), text: one(query.q).trim(),
    direct: one(query.directas) === '1', games: one(query.juegos) === '1', fresh: one(query.nuevas) === '1',
    max: max !== '' && Number.isFinite(Number(max)) && Number(max) >= 0 ? Number(max) : null,
    sort: SORTS.some(o => o.key === sort) ? sort as SortKey : 'destacadas',
    view: one(query.vista) === 'lista' ? 'lista' : 'cuadricula', hideGames,
  }
}
export function hasFilters(s: FilterState): boolean {
  return !!(s.flag || s.store || s.category || s.min || s.text || s.direct || s.games || s.fresh || s.max !== null || s.sort !== 'destacadas')
}
export function applyFilters(deals: readonly DealView[], state: Partial<FilterState> = {}): DealView[] {
  const { flag, store, category, min, text, direct, games, fresh, max, sort, hideGames } = { ...filtersFromQuery(), ...state }
  const needle = text.toLocaleLowerCase('es')
  const list = deals.filter(d =>
    (!hideGames || games || category === 'videojuegos' || d.category !== 'videojuegos')
    && (max === null || !PRICE_CURRENCIES.has(d.currency) || d.price <= max)
    && (!fresh || !d.history)
    && (!flag || d.flag === flag)
    && (!store || d.store === store)
    && (!category || d.category === category)
    && (!min || (d.discountPct ?? 0) >= min)
    && (!direct || d.direct)
    && (!needle || `${d.title} ${d.store} ${d.category ? categoryLabel(d.category) : ''}`.toLocaleLowerCase('es').includes(needle)))
  if (sort === 'descuento') return [...list].sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1) || b.score - a.score)
  if (sort === 'recientes') return [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  if (sort === 'sospecha') return [...list].sort((a, b) => b.errorScore - a.errorScore || b.score - a.score)
  if (sort === 'puntuacion') return [...list].sort((a, b) => b.score - a.score)
  return list
}

/** Distinct non-empty values with counts, most common first. */
export function tally(values: (string | null | undefined)[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const v of values) if (v && v.trim()) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
}

/** Facets ignore their own selection, but respect every other filter. */
export function filterOptions(deals: readonly DealView[], state: FilterState) {
  const base = (patch: Partial<FilterState>) => applyFilters(deals, { ...state, ...patch })
  const stores = tally(base({ store: '' }).map(d => d.store))
  const categories = tally(base({ category: '', games: true }).map(d => d.category))
  const flagBase = base({ flag: '' })
  const flags = Object.keys(FLAG_QUERY).map(flag => ({ flag, query: FLAG_QUERY[flag]!, label: FLAG_LABEL[flag]!, count: flagBase.filter(d => d.flag === flag).length })).filter(o => o.count > 0 && o.count < flagBase.length)
  const minBase = base({ min: 0 })
  const mins = MIN_DISCOUNTS.filter(m => m === 0 || (minBase.some(d => (d.discountPct ?? 0) >= m) && minBase.some(d => (d.discountPct ?? 0) < m)))
  const priceBase = base({ max: null })
  const maxes = PRICE_BUCKETS.filter(m => priceBase.some(d => PRICE_CURRENCIES.has(d.currency) && d.price <= m) && priceBase.some(d => PRICE_CURRENCIES.has(d.currency) && d.price > m))
  const freshBase = base({ fresh: false })
  const freshCount = freshBase.filter(d => !d.history).length
  const directBase = base({ direct: false })
  const directCount = directBase.filter(d => d.direct).length
  return { stores, categories, flags, mins, maxes, freshCount, directCount,
    showFresh: freshCount > 0 && freshCount < freshBase.length,
    showDirect: directCount > 0 && directCount < directBase.length,
    gamesCount: base({ games: true }).filter(d => d.category === 'videojuegos').length,
    sorts: SORTS.filter(o => o.key !== 'sospecha' || base({}).some(d => d.errorScore > 0)),
  }
}
