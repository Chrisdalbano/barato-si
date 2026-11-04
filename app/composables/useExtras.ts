import type { InjectionKey, Ref } from 'vue'
import { normalizeHighlights, normalizeOracle } from '../utils/extras'
import type { HighlightsFile, OracleFile, OraclePrediction } from '../utils/extras'

// Loaders for the pipeline's optional files. Same pattern as useErrors(): at
// build time the file is pulled in with import.meta.glob, which resolves to
// nothing (not a build error) when the file is absent; in the browser it is
// fetched, a 404 reads as null, and a newer copy replaces the prerendered one.

export async function useHighlights() {
  const fresh = shallowRef<HighlightsFile | null>(null)
  onMounted(async () => {
    try { fresh.value = normalizeHighlights(await $fetch('/api/highlights.json', { cache: 'no-cache' })) } catch { /* not published */ }
  })
  const { data } = await useAsyncData('highlights', async () => {
    if (import.meta.server) {
      try {
        const load = Object.values(import.meta.glob('../../public/api/highlights.json', { import: 'default' }))[0]
        return load ? normalizeHighlights(await load()) : null
      } catch { return null }
    }
    try { return normalizeHighlights(await $fetch('/api/highlights.json')) } catch { return null }
  })
  watch(fresh, (f) => { if (f && f.generatedAt !== data.value?.generatedAt) data.value = f })
  return data
}

export async function useOracle() {
  const fresh = shallowRef<OracleFile | null>(null)
  onMounted(async () => {
    try { fresh.value = normalizeOracle(await $fetch('/api/oracle.json', { cache: 'no-cache' })) } catch { /* not published */ }
  })
  const { data } = await useAsyncData('oracle', async () => {
    if (import.meta.server) {
      try {
        const load = Object.values(import.meta.glob('../../public/api/oracle.json', { import: 'default' }))[0]
        return load ? normalizeOracle(await load()) : null
      } catch { return null }
    }
    try { return normalizeOracle(await $fetch('/api/oracle.json')) } catch { return null }
  })
  watch(fresh, (f) => { if (f && f.generatedAt !== data.value?.generatedAt) data.value = f })
  return data
}

// The "¿espera o compra?" badge sits on cards deep in the tree. The page loads
// oracle.json once and provides a lookup by deal id; without a provider the
// lookup is empty and no badge renders.
const ORACLE_KEY: InjectionKey<Ref<Map<string, OraclePrediction>>> = Symbol('oracle')

export function provideOracle(file: Ref<OracleFile | null | undefined>) {
  const map = computed(() => new Map((file.value?.predictions ?? [])
    .filter(p => p.verdict !== 'aprendiendo')
    .map(p => [p.dealId, p] as const)))
  provide(ORACLE_KEY, map)
}

export function useOraclePick(dealId: () => string) {
  const map = inject(ORACLE_KEY, null)
  return computed(() => map?.value.get(dealId()) ?? null)
}
