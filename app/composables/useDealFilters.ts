import type { Ref } from 'vue'
import type { LocationQuery } from 'vue-router'
import type { DealView } from './useDeals'

export type SortKey = 'puntuacion' | 'descuento' | 'recientes'
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'puntuacion', label: 'Puntuación' },
  { key: 'descuento', label: 'Descuento' },
  { key: 'recientes', label: 'Recientes' },
]
export const MIN_DISCOUNTS = [0, 25, 50, 75]

const one = (v: LocationQuery[string] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? ''

/**
 * Filter + sort state lives in the query string (?tipo=&tienda=&min=&q=&orden=),
 * so a filtered view is a shareable link. The query is only read after mount:
 * the prerendered HTML is always the default view, and hydration matches it.
 */
export function useDealFilters(deals: Ref<DealView[]>) {
  const route = useRoute()
  const router = useRouter()
  const ready = ref(false)
  onMounted(() => { ready.value = true })

  const query = computed<LocationQuery>(() => (ready.value ? route.query : {}))
  const flag = computed(() => one(query.value.tipo))
  const store = computed(() => one(query.value.tienda))
  const min = computed(() => Math.max(0, Math.min(99, Number(one(query.value.min)) || 0)))
  const text = computed(() => one(query.value.q).trim())
  const sort = computed<SortKey>(() => {
    const s = one(query.value.orden)
    return SORTS.some(o => o.key === s) ? (s as SortKey) : 'puntuacion'
  })
  const active = computed(() => !!(flag.value || store.value || min.value || text.value || sort.value !== 'puntuacion'))

  function set(patch: Record<string, string | number | null>) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
      const value = Array.isArray(v) ? v[0] : v
      if (value !== null && value !== undefined && value !== '' && value !== 0 && value !== '0') next[k] = String(value)
    }
    if (next.orden === 'puntuacion') delete next.orden
    router.replace({ query: next })
  }
  function reset() {
    set({ tipo: null, tienda: null, min: null, q: null, orden: null })
  }

  const stores = computed(() => {
    const counts = new Map<string, number>()
    for (const d of deals.value) counts.set(d.store, (counts.get(d.store) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
  })

  const results = computed(() => {
    const needle = text.value.toLocaleLowerCase('es')
    const list = deals.value.filter(d =>
      (!flag.value || d.flag === flag.value)
      && (!store.value || d.store === store.value)
      && (!min.value || (d.discountPct ?? 0) >= min.value)
      && (!needle || `${d.title} ${d.store} ${d.category ?? ''}`.toLocaleLowerCase('es').includes(needle)))
    if (sort.value === 'descuento') return [...list].sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1) || b.score - a.score)
    if (sort.value === 'recientes') return [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    return [...list].sort((a, b) => b.score - a.score)
  })

  return { ready, flag, store, min, text, sort, active, stores, results, set, reset }
}
