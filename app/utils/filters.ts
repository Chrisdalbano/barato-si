import type { DealView } from '../composables/useDeals'
import { categoryLabel, depthOf, ERROR_LEVELS, EVIDENCE, EVIDENCE_ORDER, evidenceOf, evidenceText } from './deal'
import { FLAG_QUERY, flagFromQuery, flagLabel } from './format'
import type { Locale } from './locale'

export type SortKey =
  | 'destacadas' | 'sospecha' | 'interes' | 'profundidad' | 'precio' | 'recientes'
  // Column sorts of the table.
  | 'producto' | 'marca' | 'tienda' | 'referencia'
  // Older links keep working; no longer offered.
  | 'puntuacion' | 'descuento'
export type SortDir = 'asc' | 'desc'
export type ViewKey = 'tabla' | 'cuadricula'

const parseTime = (iso: string): number | null => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null }
const SORT_SPEC: Record<Exclude<SortKey, 'destacadas'>, { dir: SortDir; value: (d: DealView) => number | string | null }> = {
  sospecha: { dir: 'desc', value: d => d.errorScore },
  interes: { dir: 'desc', value: d => d.interest ?? null },
  profundidad: { dir: 'desc', value: d => depthOf(d) },
  precio: { dir: 'asc', value: d => d.price },
  referencia: { dir: 'desc', value: d => d.reference?.price ?? null },
  recientes: { dir: 'desc', value: d => parseTime(d.publishedAt) },
  producto: { dir: 'asc', value: d => d.title },
  marca: { dir: 'asc', value: d => d.brand ?? null },
  tienda: { dir: 'asc', value: d => d.store },
  puntuacion: { dir: 'desc', value: d => d.score },
  descuento: { dir: 'desc', value: d => d.discountPct ?? null },
}
const isSortKey = (v: string): v is SortKey => v === 'destacadas' || v in SORT_SPEC

export function defaultDir(key: SortKey): SortDir {
  return key === 'destacadas' ? 'desc' : SORT_SPEC[key].dir
}

/** What the sort control offers. `value` is `key`, or `key:dir` when the direction is not the key's own. */
export const SORTS: { key: SortKey; value: string; label: string }[] = [
  { key: 'destacadas', value: 'destacadas', label: 'Editorial' },
  { key: 'sospecha', value: 'sospecha', label: 'Error' },
  { key: 'interes', value: 'interes', label: 'Interés' },
  { key: 'profundidad', value: 'profundidad', label: 'Profundidad' },
  { key: 'precio', value: 'precio', label: 'Precio, de menor a mayor' },
  { key: 'precio', value: 'precio:desc', label: 'Precio, de mayor a menor' },
  { key: 'recientes', value: 'recientes', label: 'Más recientes' },
]
const SORT_LABEL_EN: Record<string, string> = {
  destacadas: 'Editorial', sospecha: 'Error', interes: 'Interest', profundidad: 'Depth',
  precio: 'Price, low to high', 'precio:desc': 'Price, high to low', recientes: 'Newest',
}
/** The sort control's options in the page language. */
export function sortsFor(loc: Locale = 'es'): typeof SORTS {
  return loc === 'en' ? SORTS.map(o => ({ ...o, label: SORT_LABEL_EN[o.value] ?? o.label })) : SORTS
}
const OTHER_SORT_LABEL_EN: Partial<Record<SortKey, string>> = {
  producto: 'Product', marca: 'Brand', tienda: 'Store', referencia: 'Reference',
  puntuacion: 'Score', descuento: 'Declared discount', sospecha: 'Error', interes: 'Interest',
  profundidad: 'Depth', recientes: 'Oldest',
}
const OTHER_SORT_LABEL: Partial<Record<SortKey, string>> = {
  producto: 'Producto', marca: 'Marca', tienda: 'Tienda', referencia: 'Referencia',
  puntuacion: 'Puntuación', descuento: 'Descuento declarado', sospecha: 'Error', interes: 'Interés',
  profundidad: 'Profundidad', recientes: 'Más antiguas',
}

export const MIN_DISCOUNTS = [0, 25, 50, 75, 90]
export const INTEREST_LEVELS = [25, 50, 75]
export const PRICE_BUCKETS = [25, 50, 100, 250, 500, 1000]
const PRICE_CURRENCIES = new Set(['USD', 'EUR', 'GBP'])

export interface FilterState {
  flag: string; stores: string[]; brands: string[]; category: string
  /** Minimum depth against the reference (declared discount when there is none). */
  min: number
  text: string
  /** Rows with a direct link only. */
  direct: boolean
  /** This page shows direct links only unless the reader asks otherwise. */
  directDefault: boolean
  games: boolean; fresh: boolean
  priceMin: number | null; max: number | null
  evidence: string[]; interest: number; errorLevel: number
  staff: boolean; corroborated: boolean
  sort: SortKey; dir: SortDir | null; view: ViewKey; hideGames: boolean
}

type Query = Record<string, string | null | (string | null)[] | undefined>
const one = (v: Query[string]): string => (Array.isArray(v) ? v[0] : v) ?? ''
const many = (v: Query[string]): string[] => {
  const list = Array.isArray(v) ? v : v ? [v] : []
  return [...new Set(list.map(s => (s ?? '').trim()).filter(Boolean))]
}
/** A finite, non-negative number; null for anything else, including empty. */
const amount = (v: Query[string]): number | null => {
  const raw = one(v).trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}
const percent = (v: Query[string], ceiling: number): number => Math.min(ceiling, amount(v) ?? 0)

export function filtersFromQuery(query: Query = {}, hideGames = true, directDefault = false): FilterState {
  const sort = one(query.orden)
  const dir = one(query.dir)
  return {
    flag: flagFromQuery(one(query.tipo)), stores: many(query.tienda), brands: many(query.marca), category: one(query.cat),
    min: percent(query.min, 99), text: one(query.q).trim(),
    direct: one(query.directas) === '1' || (directDefault && one(query.intermediarios) !== '1'),
    directDefault,
    games: one(query.juegos) === '1', fresh: one(query.nuevas) === '1',
    priceMin: amount(query.desde) || null, max: amount(query.max),
    evidence: many(query.evidencia).filter(k => k in EVIDENCE),
    interest: percent(query.interes, 100), errorLevel: percent(query.error, 100),
    staff: one(query.elegida) === '1', corroborated: one(query.corroborada) === '1',
    sort: isSortKey(sort) ? sort : 'destacadas',
    dir: dir === 'asc' || dir === 'desc' ? dir : null,
    // Old links say vista=lista: that view became the table.
    view: one(query.vista) === 'cuadricula' ? 'cuadricula' : 'tabla',
    hideGames,
  }
}

export function hasFilters(s: FilterState): boolean {
  return activeItems(s).length > 0 || s.sort !== 'destacadas'
}

/** Accent-insensitive lowercase for the search box. */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

export const isCorroborated = (d: Pick<DealView, 'seenIn'>): boolean => (d.seenIn?.length ?? 0) >= 2

export function applyFilters(deals: readonly DealView[], state: Partial<FilterState> = {}): DealView[] {
  const s = { ...filtersFromQuery(), ...state }
  const needle = fold(s.text)
  const inPriceScope = (d: DealView) => PRICE_CURRENCIES.has(d.currency)
  const list = deals.filter(d =>
    (!s.hideGames || s.games || s.category === 'videojuegos' || d.category !== 'videojuegos')
    && (s.max === null || !inPriceScope(d) || d.price <= s.max)
    && (s.priceMin === null || !inPriceScope(d) || d.price >= s.priceMin)
    && (!s.fresh || !d.history)
    && (!s.flag || d.flag === s.flag)
    && (!s.stores.length || s.stores.includes(d.store))
    && (!s.brands.length || (!!d.brand && s.brands.includes(d.brand)))
    && (!s.category || d.category === s.category)
    && (!s.min || (depthOf(d) ?? 0) >= s.min)
    && (!s.evidence.length || s.evidence.includes(evidenceOf(d)))
    && (!s.interest || (d.interest ?? 0) >= s.interest)
    && (!s.errorLevel || d.errorScore >= s.errorLevel)
    && (!s.staff || !!d.staffPick)
    && (!s.corroborated || isCorroborated(d))
    && (!s.direct || d.direct)
    && (!needle || fold(`${d.title} ${d.brand ?? ''} ${d.store} ${d.category ? `${categoryLabel(d.category)} ${categoryLabel(d.category, 'en')}` : ''}`).includes(needle)))
  return sortDeals(list, s.sort, s.dir)
}

/** Missing values go last in either direction. Ties keep the better score, then file order. */
export function sortDeals(list: DealView[], key: SortKey, dir: SortDir | null = null): DealView[] {
  if (key === 'destacadas') return list
  const spec = SORT_SPEC[key]
  const sign = (dir ?? spec.dir) === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const x = spec.value(a)
    const y = spec.value(b)
    if (x === null || y === null) return x === y ? b.score - a.score : x === null ? 1 : -1
    const c = typeof x === 'number' && typeof y === 'number'
      ? x - y
      : String(x).localeCompare(String(y), 'es', { sensitivity: 'base' })
    return sign * c || b.score - a.score
  })
}

/** Distinct non-empty values with counts, most common first. */
export function tally(values: (string | null | undefined)[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const v of values) if (v && v.trim()) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
}

/** A selected value with no matches stays listed, so it can still be cleared. */
const keepSelected = (rows: [string, number][], selected: string[]): [string, number][] =>
  [...rows, ...selected.filter(s => !rows.some(r => r[0] === s)).map((s): [string, number] => [s, 0])]

/** Facets ignore their own selection, but respect every other filter. */
export function filterOptions(deals: readonly DealView[], state: FilterState, loc: Locale = 'es') {
  const base = (patch: Partial<FilterState>) => applyFilters(deals, { ...state, sort: 'destacadas', ...patch })
  const stores = keepSelected(tally(base({ stores: [] }).map(d => d.store)), state.stores)
  const brands = keepSelected(tally(base({ brands: [] }).map(d => d.brand)), state.brands)
  const categories = keepSelected(tally(base({ category: '', games: true }).map(d => d.category)), state.category ? [state.category] : [])
  const flagBase = base({ flag: '' })
  const flags = Object.keys(FLAG_QUERY).map(flag => ({ flag, query: FLAG_QUERY[flag]!, label: flagLabel(flag, loc), count: flagBase.filter(d => d.flag === flag).length })).filter(o => o.count > 0 && o.count < flagBase.length)
  const minBase = base({ min: 0 })
  const mins = MIN_DISCOUNTS.filter(m => m === 0 || (minBase.some(d => (depthOf(d) ?? 0) >= m) && minBase.some(d => (depthOf(d) ?? 0) < m)))
  const minFacet = [...new Set([...mins.filter(m => m > 0), ...(state.min ? [state.min] : [])])]
    .sort((a, b) => a - b)
    .map(level => ({ level, count: minBase.filter(d => (depthOf(d) ?? 0) >= level).length }))
  const priceBase = base({ max: null, priceMin: null })
  const inScope = priceBase.filter(d => PRICE_CURRENCIES.has(d.currency))
  const maxes = PRICE_BUCKETS.filter(m => inScope.some(d => d.price <= m) && inScope.some(d => d.price > m))
  const evidenceBase = base({ evidence: [] })
  const evidence = EVIDENCE_ORDER
    .map(key => ({ key, label: evidenceText(key, loc).label, strength: EVIDENCE[key].strength, count: evidenceBase.filter(d => evidenceOf(d) === key).length }))
    .filter(o => o.count > 0 || state.evidence.includes(o.key))
  const interestBase = base({ interest: 0 })
  const interests = [...new Set([...INTEREST_LEVELS, ...(state.interest ? [state.interest] : [])])]
    .sort((a, b) => a - b)
    .map(level => ({ level, count: interestBase.filter(d => (d.interest ?? 0) >= level).length }))
    .filter(o => (o.count > 0 && o.count < interestBase.length) || o.level === state.interest)
  const errorBase = base({ errorLevel: 0 })
  const errorLevels = [...new Set([...ERROR_LEVELS as readonly number[], ...(state.errorLevel ? [state.errorLevel] : [])])]
    .sort((a, b) => a - b)
    .map(level => ({ level, count: errorBase.filter(d => d.errorScore >= level).length }))
    .filter(o => o.count > 0 || o.level === state.errorLevel)
  const freshBase = base({ fresh: false })
  const freshCount = freshBase.filter(d => !d.history).length
  const directBase = base({ direct: false })
  const directCount = directBase.filter(d => d.direct).length
  const staffCount = base({ staff: false }).filter(d => d.staffPick).length
  const corroboratedCount = base({ corroborated: false }).filter(isCorroborated).length
  const all = base({})
  const has: Partial<Record<SortKey, boolean>> = {
    sospecha: all.some(d => d.errorScore > 0),
    interes: all.some(d => d.interest != null),
    profundidad: all.some(d => depthOf(d) != null),
  }
  return { stores, brands, categories, flags, mins, minFacet, maxes, evidence, interests, errorLevels,
    freshCount, directCount, staffCount, corroboratedCount,
    middlemanCount: directBase.length - directCount,
    showFresh: freshCount > 0 && freshCount < freshBase.length,
    showDirect: directCount > 0 && directCount < directBase.length,
    gamesCount: base({ games: true }).filter(d => d.category === 'videojuegos').length,
    sorts: sortsFor(loc).filter(o => has[o.key] !== false),
  }
}

/** The sort control's value for a state. */
export function sortValue(s: Pick<FilterState, 'sort' | 'dir'>): string {
  return !s.dir || s.dir === defaultDir(s.sort) ? s.sort : `${s.sort}:${s.dir}`
}
/** Label for a column sort the control does not list, so it can still show the current order. */
export function sortLabel(s: Pick<FilterState, 'sort' | 'dir'>, loc: Locale = 'es'): string {
  const base = (loc === 'en' ? OTHER_SORT_LABEL_EN : OTHER_SORT_LABEL)[s.sort] ?? s.sort
  return s.dir && s.dir !== defaultDir(s.sort) && s.sort !== 'recientes' ? `${base}, ${loc === 'en' ? 'reversed' : 'invertido'}` : base
}

export type QueryPatch = Record<string, string | number | string[] | null>
export interface ActiveItem { id: string; label: string; patch: QueryPatch }

const ACTIVE_WORDS = {
  es: { q: 'Búsqueda', cat: 'Categoría', brand: 'Marca', store: 'Tienda', from: 'Desde', to: 'Hasta', depth: (n: number) => `Profundidad: ${n} % o más`, evidence: 'Evidencia', interest: (n: number) => `Interés: ${n} o más`, error: (n: number) => `Error: ${n} o más`, direct: 'Solo enlaces directos', middle: 'Con intermediarios', games: 'Con videojuegos', fresh: 'Nuevas hoy', staff: 'Elección editorial', corroborated: 'En dos fuentes o más' },
  en: { q: 'Search', cat: 'Category', brand: 'Brand', store: 'Store', from: 'From', to: 'Up to', depth: (n: number) => `Depth: ${n}% or more`, evidence: 'Evidence', interest: (n: number) => `Interest: ${n} or more`, error: (n: number) => `Error: ${n} or more`, direct: 'Direct links only', middle: 'With middlemen', games: 'With video games', fresh: 'New today', staff: 'Editors\' pick', corroborated: 'In two sources or more' },
}

/** Every narrowing in force, as a removable line of text. A default view lists nothing. */
export function activeItems(s: FilterState, loc: Locale = 'es'): ActiveItem[] {
  const w = ACTIVE_WORDS[loc]
  const out: ActiveItem[] = []
  const add = (id: string, label: string, patch: QueryPatch) => out.push({ id, label, patch })
  if (s.text) add('q', `${w.q}: ${s.text}`, { q: null })
  if (s.category) add('cat', `${w.cat}: ${categoryLabel(s.category, loc)}`, { cat: null })
  for (const b of s.brands) add(`marca:${b}`, `${w.brand}: ${b}`, { marca: s.brands.filter(x => x !== b) })
  for (const t of s.stores) add(`tienda:${t}`, `${w.store}: ${t}`, { tienda: s.stores.filter(x => x !== t) })
  if (s.priceMin !== null) add('desde', `${w.from} ${s.priceMin}`, { desde: null })
  if (s.max !== null) add('max', `${w.to} ${s.max}`, { max: null })
  if (s.min) add('min', w.depth(s.min), { min: null })
  for (const k of s.evidence) add(`evidencia:${k}`, `${w.evidence}: ${evidenceText(k as keyof typeof EVIDENCE, loc).label}`, { evidencia: s.evidence.filter(x => x !== k) })
  if (s.interest) add('interes', w.interest(s.interest), { interes: null })
  if (s.errorLevel) add('error', w.error(s.errorLevel), { error: null })
  if (s.flag) add('tipo', flagLabel(s.flag, loc), { tipo: null })
  if (s.direct && !s.directDefault) add('directas', w.direct, { directas: null })
  if (!s.direct && s.directDefault) add('intermediarios', w.middle, { intermediarios: null })
  if (s.games) add('juegos', w.games, { juegos: null })
  if (s.fresh) add('nuevas', w.fresh, { nuevas: null })
  if (s.staff) add('elegida', w.staff, { elegida: null })
  if (s.corroborated) add('corroborada', w.corroborated, { corroborada: null })
  return out
}

/** Clears every filter and the sort; keeps the view and anything that is not a filter (?dia=). */
export const RESET_PATCH: QueryPatch = {
  q: null, cat: null, marca: null, tienda: null, desde: null, max: null, min: null, evidencia: null,
  interes: null, error: null, tipo: null, directas: null, intermediarios: null, juegos: null, nuevas: null,
  elegida: null, corroborada: null, orden: null, dir: null,
}
