import type { Deal, DealsFile } from '~~/lib/types'

/** What the UI actually renders. Syndicated XML/HTML stays in the API, never in the page payload. */
export type DealView = Omit<Deal, 'syndication' | 'image' | 'sourceSignal' | 'foundAt'>
export interface DayView extends Omit<DealsFile, 'deals'> { deals: DealView[] }
export interface ArchiveIndex { latest: string; days: string[] }

export function toView(file: DealsFile): DayView {
  return {
    date: file.date,
    generatedAt: file.generatedAt,
    count: file.count,
    sources: file.sources ?? [],
    deals: (file.deals ?? []).map(d => ({
      id: d.id, title: d.title, url: d.url, store: d.store, source: d.source, sourceUrl: d.sourceUrl,
      currency: d.currency, price: d.price, listPrice: d.listPrice, discountPct: d.discountPct,
      category: d.category, publishedAt: d.publishedAt, score: d.score, flag: d.flag, reasons: d.reasons ?? [],
    })),
  }
}

/**
 * Today's file. During `nuxt generate` the JSON written by the pipeline is
 * bundled into the server build, so the prerendered HTML carries real deals.
 * After hydration the browser asks /api/deals.json for anything newer.
 */
export async function useToday() {
  const { data } = await useAsyncData('today', async () => {
    if (import.meta.server) {
      const mod = await import('../../public/api/deals.json')
      return toView(mod.default as unknown as DealsFile)
    }
    return toView(await $fetch<DealsFile>('/api/deals.json'))
  })

  onMounted(async () => {
    try {
      const fresh = await $fetch<DealsFile>('/api/deals.json', { cache: 'no-cache' })
      if (fresh?.generatedAt && fresh.generatedAt !== data.value?.generatedAt) data.value = toView(fresh)
    } catch {
      // Keep the prerendered copy; it is the same file as of the last build.
    }
  })

  return data
}

export async function useArchiveIndex() {
  const { data } = await useAsyncData('archive-index', async () => {
    if (import.meta.server) {
      const mod = await import('../../public/api/index.json')
      return mod.default as ArchiveIndex
    }
    return await $fetch<ArchiveIndex>('/api/index.json')
  })
  onMounted(async () => {
    try { data.value = await $fetch<ArchiveIndex>('/api/index.json', { cache: 'no-cache' }) } catch { /* keep build copy */ }
  })
  return data
}

export const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export async function fetchDay(date: string): Promise<DayView> {
  if (!isDay(date)) throw new Error('Fecha no válida')
  return toView(await $fetch<DealsFile>(`/api/deals/${date}.json`))
}
