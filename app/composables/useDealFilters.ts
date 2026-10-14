import { computed, onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import { applyFilters, filterOptions, filtersFromQuery, hasFilters } from '../utils/filters'
import type { DealView } from './useDeals'

/** Read URL state only after mount, preserving the default prerendered view. */
export function useDealFilters(deals: Ref<DealView[]>, hideGames: Ref<boolean>) {
  const route = useRoute()
  const router = useRouter()
  const ready = ref(false)
  onMounted(() => { ready.value = true })
  const state = computed(() => filtersFromQuery(ready.value ? route.query : {}, hideGames.value))
  const options = computed(() => filterOptions(deals.value, state.value))
  const active = computed(() => hasFilters(state.value))
  const results = computed(() => applyFilters(deals.value, state.value))
  function set(patch: Record<string, string | number | null>) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
      const value = Array.isArray(v) ? v[0] : v
      if (value !== null && value !== undefined && value !== '') next[k] = String(value)
    }
    if (next.orden === 'destacadas') delete next.orden
    if (next.vista === 'cuadricula') delete next.vista
    router.replace({ query: next })
  }
  function reset() {
    set({ tipo: null, tienda: null, cat: null, min: null, q: null, orden: null, directas: null, juegos: null, max: null, nuevas: null })
  }
  return { ready, flag: computed(() => state.value.flag),
    store: computed(() => state.value.store),
    category: computed(() => state.value.category),
    min: computed(() => state.value.min),
    text: computed(() => state.value.text),
    direct: computed(() => state.value.direct),
    games: computed(() => state.value.games),
    fresh: computed(() => state.value.fresh),
    max: computed(() => state.value.max),
    sort: computed(() => state.value.sort),
    view: computed(() => state.value.view),
    stores: computed(() => options.value.stores),
    categories: computed(() => options.value.categories),
    flags: computed(() => options.value.flags),
    mins: computed(() => options.value.mins),
    maxes: computed(() => options.value.maxes),
    freshCount: computed(() => options.value.freshCount),
    directCount: computed(() => options.value.directCount),
    showFresh: computed(() => options.value.showFresh),
    showDirect: computed(() => options.value.showDirect),
    gamesCount: computed(() => options.value.gamesCount),
    sorts: computed(() => options.value.sorts), active, results, set, reset }
}
