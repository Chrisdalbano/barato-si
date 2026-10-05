import type { Ref } from 'vue'
import type { LocationQuery } from 'vue-router'
import type { DealView } from './useDeals'

export type SortKey = 'destacadas' | 'puntuacion' | 'descuento' | 'recientes'
export const SORTS: { key: SortKey; label: string }[] = [
  // Default: the file's own order (balanced across sources by the pipeline).
  { key: 'destacadas', label: 'Destacadas' },
  { key: 'puntuacion', label: 'Puntuación' },
  { key: 'descuento', label: 'Descuento' },
  { key: 'recientes', label: 'Recientes' },
]
export const MIN_DISCOUNTS = [0, 25, 50, 75]

const one = (v: LocationQuery[string] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? ''

/**
 * Filter + sort state lives in the query string (?tipo=&tienda=&cat=&min=&q=&orden=),
 * so a filtered view is a shareable link. The query is only read after mount:
 * the prerendered HTML is always the default view, and hydration matches it.
 */
export function useDealFilters(deals: Ref<DealView[]>) {
  const route = useRoute()
  const router = useRouter()
  const ready = ref(false)
  onMounted(() => { ready.value = true })

  const query = computed<LocationQuery>(() => (ready.value ? route.query : {}))
  // ?tipo= carries a readable value (baratisimo, posible-error); flag is the data value.
  const flag = computed(() => flagFromQuery(one(query.value.tipo)))
  const store = computed(() => one(query.value.tienda))
  const category = computed(() => one(query.value.cat))
  const min = computed(() => Math.max(0, Math.min(99, Number(one(query.value.min)) || 0)))
  const text = computed(() => one(query.value.q).trim())
  const sort = computed<SortKey>(() => {
    const s = one(query.value.orden)
    return SORTS.some(o => o.key === s) ? (s as SortKey) : 'destacadas'
  })
  const active = computed(() => !!(flag.value || store.value || category.value || min.value || text.value || sort.value !== 'destacadas'))

  function set(patch: Record<string, string | number | null>) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
      const value = Array.isArray(v) ? v[0] : v
      if (value !== null && value !== undefined && value !== '' && value !== 0 && value !== '0') next[k] = String(value)
    }
    if (next.orden === 'destacadas') delete next.orden
    router.replace({ query: next })
  }
  function reset() {
    set({ tipo: null, tienda: null, cat: null, min: null, q: null, orden: null })
  }

  const stores = computed(() => tally(deals.value.map(d => d.store)))
  const categories = computed(() => tally(deals.value.map(d => d.category)))
  /** Flag counts, only for flags that actually appear today. */
  const flags = computed(() => {
    const counts = new Map<string, number>()
    for (const d of deals.value) if (d.flag in FLAG_QUERY) counts.set(d.flag, (counts.get(d.flag) ?? 0) + 1)
    return Object.keys(FLAG_QUERY).filter(k => counts.has(k)).map(k => ({ flag: k, query: FLAG_QUERY[k]!, label: FLAG_LABEL[k]!, count: counts.get(k)! }))
  })
  /** Minimum-discount thresholds that at least one deal reaches. */
  const mins = computed(() => {
    const best = Math.max(-1, ...deals.value.map(d => d.discountPct ?? -1))
    return MIN_DISCOUNTS.filter(m => m === 0 || best >= m)
  })

  const results = computed(() => {
    const needle = text.value.toLocaleLowerCase('es')
    const list = deals.value.filter(d =>
      (!flag.value || d.flag === flag.value)
      && (!store.value || d.store === store.value)
      && (!category.value || d.category === category.value)
      && (!min.value || (d.discountPct ?? 0) >= min.value)
      && (!needle || `${d.title} ${d.store} ${d.category ?? ''}`.toLocaleLowerCase('es').includes(needle)))
    if (sort.value === 'descuento') return [...list].sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1) || b.score - a.score)
    if (sort.value === 'recientes') return [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    if (sort.value === 'puntuacion') return [...list].sort((a, b) => b.score - a.score)
    return list
  })

  return { ready, flag, store, category, min, text, sort, active, stores, categories, flags, mins, results, set, reset }
}

/** Distinct non-empty values with counts, most common first. */
function tally(values: (string | null | undefined)[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const v of values) if (v && v.trim()) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
}
