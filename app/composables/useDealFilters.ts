import { computed, onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import { activeItems, applyFilters, defaultDir, filterOptions, filtersFromQuery, hasFilters, RESET_PATCH } from '../utils/filters'
import type { QueryPatch, SortKey } from '../utils/filters'
import type { DealView } from './useDeals'

export type DealFilters = ReturnType<typeof useDealFilters>

/** Read URL state only after mount, preserving the default prerendered view. */
export function useDealFilters(deals: Ref<DealView[]>, hideGames: Ref<boolean>, directDefault: Ref<boolean>) {
  const route = useRoute()
  const router = useRouter()
  const ready = ref(false)
  onMounted(() => { ready.value = true })

  // A file with no direct rows at all (an old archive) has nothing to default to.
  const defaultsToDirect = computed(() => directDefault.value && deals.value.some(d => d.direct))
  const state = computed(() => filtersFromQuery(ready.value ? route.query : {}, hideGames.value, defaultsToDirect.value))
  const options = computed(() => filterOptions(deals.value, state.value))
  const items = computed(() => activeItems(state.value))
  const active = computed(() => hasFilters(state.value))
  const results = computed(() => applyFilters(deals.value, state.value))

  function set(patch: QueryPatch) {
    const next: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
      if (Array.isArray(v)) {
        const list = (v as (string | null)[]).filter((s): s is string => !!s)
        if (list.length) next[k] = list
      } else if (v !== null && v !== undefined && v !== '') next[k] = String(v)
    }
    if (next.orden === 'destacadas') { delete next.orden; delete next.dir }
    if (next.vista === 'tabla' || next.vista === 'lista') delete next.vista
    router.replace({ query: next })
  }
  function reset() { set(RESET_PATCH) }

  /** Add or remove one value of a multi-value key. */
  function toggleIn(key: string, selected: string[], value: string) {
    set({ [key]: selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value] })
  }

  /** The one control for middleman rows. */
  function toggleMiddlemen() {
    const include = state.value.direct
    if (state.value.directDefault) set({ intermediarios: include ? '1' : null, directas: null })
    else set({ directas: include ? null : '1' })
  }

  /** A table header: first click applies the column's natural order, the next flips it. */
  function sortBy(key: SortKey) {
    const s = state.value
    const current = s.dir ?? defaultDir(key)
    const dir = s.sort === key ? (current === 'asc' ? 'desc' : 'asc') : defaultDir(key)
    set({ orden: key, dir: dir === defaultDir(key) ? null : dir })
  }
  /** The sort control: "key" or "key:dir". */
  function setSort(value: string) {
    const [orden, dir] = value.split(':')
    set({ orden: orden ?? null, dir: dir ?? null })
  }

  return { ready, state, options, items, active, results, set, reset, toggleIn, toggleMiddlemen, sortBy, setSort }
}
