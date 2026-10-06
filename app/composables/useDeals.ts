import type { Deal, DealsFile, SourceOutcome } from '~~/lib/types'

/**
 * What the UI actually renders. Syndicated XML/HTML, raw source text and
 * internal timestamps stay in the API, never in the page payload. Every v2
 * field is normalized here with a default, so v1 files (and archives written
 * before the pipeline caught up) render the same way.
 */
export interface DealView extends Omit<Deal, 'syndication' | 'sourceSignal' | 'sourceText' | 'foundAt' | 'ai'> {
  /** Trimmed model note (only what the page shows). */
  ai?: { verdict: NonNullable<Deal['ai']>['verdict']; confidence: number; note: string }
  /** Linked straight to the merchant: a storeUrl, or a first-party source (Steam, GOG, Epic). */
  direct: boolean
}
export interface DayView extends Omit<DealsFile, 'deals' | 'sources'> { sources: SourceOutcome[]; deals: DealView[] }
export interface ErrorsView { date: string; generatedAt: string; deals: DealView[] }
export interface ArchiveIndex { latest: string; days: string[] }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

export function toDealView(d: Deal, directSources: ReadonlySet<string> = new Set()): DealView {
  const storeUrl = str(d.storeUrl)
  const ai = d.ai && typeof d.ai.note === 'string'
    ? { verdict: d.ai.verdict, confidence: num(d.ai.confidence, 0), note: d.ai.note }
    : undefined
  const h = d.history
  const history = h && typeof h.firstSeen === 'string'
    ? { days: num(h.days, 0), minPrice: num(h.minPrice, NaN), maxPrice: num(h.maxPrice, NaN), firstSeen: h.firstSeen }
    : undefined
  return {
    id: d.id, title: d.title, url: d.url, storeUrl, store: d.store, storeDomain: str(d.storeDomain),
    source: d.source, sourceUrl: d.sourceUrl,
    currency: d.currency, price: d.price, listPrice: d.listPrice ?? null, discountPct: d.discountPct ?? null,
    image: str(d.image) && /^https?:\/\//.test(d.image!) ? d.image : null,
    category: d.category ?? null, publishedAt: d.publishedAt, score: num(d.score, 0),
    errorScore: Math.max(0, Math.min(100, num(d.errorScore, 0))),
    errorSignals: Array.isArray(d.errorSignals) ? d.errorSignals.filter(s => typeof s === 'string' && s.trim()) : [],
    flag: d.flag, reasons: d.reasons ?? [],
    ...(history ? { history } : {}),
    ...(ai ? { ai } : {}),
    direct: !!storeUrl || directSources.has(d.source.toLocaleLowerCase('en')),
  }
}

/** First-party sources (direct: true) by lowercase name. */
function directOf(sources: SourceOutcome[] | undefined): Set<string> {
  return new Set((sources ?? []).filter(s => s?.direct).map(s => s.name.toLocaleLowerCase('en')))
}

export function toView(file: DealsFile): DayView {
  const sources = file.sources ?? []
  const direct = directOf(sources)
  return {
    date: file.date,
    generatedAt: file.generatedAt,
    count: file.count,
    sources,
    ...(file.classifier ? { classifier: file.classifier } : {}),
    ...(file.version ? { version: file.version } : {}),
    deals: (file.deals ?? []).map(d => toDealView(d, direct)),
  }
}

/** Price-error candidates from a day file, for when errors.json is not there (yet). */
export function errorsFromDay(day: DayView, min = 40): ErrorsView {
  return {
    date: day.date,
    generatedAt: day.generatedAt,
    deals: day.deals.filter(d => d.errorScore >= min).sort((a, b) => b.errorScore - a.errorScore),
  }
}

interface ErrorsFile { date: string; generatedAt: string; deals: Deal[] }
function toErrorsView(file: ErrorsFile, direct: Set<string>): ErrorsView {
  return {
    date: file.date,
    generatedAt: file.generatedAt,
    deals: (file.deals ?? []).map(d => toDealView(d, direct)).sort((a, b) => b.errorScore - a.errorScore),
  }
}

/**
 * Today's file. During `nuxt generate` the JSON written by the pipeline is
 * bundled into the server build, so the prerendered HTML carries real deals.
 * After hydration the browser asks /api/deals.json for anything newer.
 */
export async function useToday() {
  // Lifecycle hooks must be registered before the first await: after it the
  // component instance is no longer current and onMounted would be dropped.
  const fresh = shallowRef<DayView | null>(null)
  onMounted(async () => {
    try {
      const file = await $fetch<DealsFile>('/api/deals.json', { cache: 'no-cache' })
      if (file?.generatedAt) fresh.value = toView(file)
    } catch {
      // Keep the prerendered copy; it is the same file as of the last build.
    }
  })

  const { data } = await useAsyncData('today', async () => {
    if (import.meta.server) {
      const mod = await import('../../public/api/deals.json')
      return toView(mod.default as unknown as DealsFile)
    }
    return toView(await $fetch<DealsFile>('/api/deals.json'))
  })

  watch(fresh, (f) => {
    if (f && f.generatedAt !== data.value?.generatedAt) data.value = f
  })

  return data
}

export async function useArchiveIndex() {
  const fresh = shallowRef<ArchiveIndex | null>(null)
  onMounted(async () => {
    try { fresh.value = await $fetch<ArchiveIndex>('/api/index.json', { cache: 'no-cache' }) } catch { /* keep build copy */ }
  })
  const { data } = await useAsyncData('archive-index', async () => {
    if (import.meta.server) {
      const mod = await import('../../public/api/index.json')
      return mod.default as ArchiveIndex
    }
    return await $fetch<ArchiveIndex>('/api/index.json')
  })
  watch(fresh, (f) => { if (f) data.value = f })
  return data
}

export const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export async function fetchDay(date: string): Promise<DayView> {
  if (!isDay(date)) throw new Error('Fecha no válida')
  return toView(await $fetch<DealsFile>(`/api/deals/${date}.json`))
}

/**
 * The price-error file. errors.json is written by the pipeline from v2 on; when
 * it is missing (older pipeline, or a build that ran first) the page falls back
 * to today's deals.json filtered to errorScore >= 40. During `nuxt generate`
 * the file is pulled in with import.meta.glob, which resolves to nothing rather
 * than failing the build when the file does not exist.
 */
export async function useErrors() {
  const fresh = shallowRef<ErrorsView | null>(null)
  onMounted(async () => {
    try { fresh.value = await fetchErrors({ cache: 'no-cache' }) } catch { /* keep the build copy */ }
  })

  const { data } = await useAsyncData('errors', async () => {
    if (import.meta.server) {
      const today = toView((await import('../../public/api/deals.json')).default as unknown as DealsFile)
      try {
        const files = import.meta.glob<ErrorsFile>('../../public/api/errors.json', { import: 'default' })
        const load = Object.values(files)[0]
        if (load) {
          const file = await load()
          if (Array.isArray(file?.deals)) return toErrorsView(file, directOf(today.sources))
        }
      } catch { /* fall through to the day file */ }
      return errorsFromDay(today)
    }
    return await fetchErrors()
  })

  watch(fresh, (f) => {
    if (f && (f.generatedAt !== data.value?.generatedAt || f.deals.length !== data.value?.deals.length)) data.value = f
  })
  return data
}

async function fetchErrors(opts: { cache?: RequestCache } = {}): Promise<ErrorsView> {
  // The day file is needed either way: for the direct-source list, and as the fallback.
  const day = toView(await $fetch<DealsFile>('/api/deals.json', opts))
  try {
    const file = await $fetch<ErrorsFile>('/api/errors.json', opts)
    if (Array.isArray(file?.deals)) return toErrorsView(file, directOf(day.sources))
  } catch { /* not published yet */ }
  return errorsFromDay(day)
}
