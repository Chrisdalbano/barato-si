import type { Deal, DealsFile, SourceOutcome } from '../lib/types.ts'
import { normalizeSource, type Source } from '../lib/normalize.ts'
import { dedupe } from '../lib/dedupe.ts'
import { scoreDeal } from '../lib/rank.ts'
import { bounded } from '../lib/budget.ts'
import { classify, type ClassifyCache } from '../lib/classify.ts'
import type { RequestContext } from './network.ts'
import { retainCollected } from './outputs.ts'
export { readPrevious } from './history.ts'
export { writeOutputs, rss } from './outputs.ts'

interface CollectOptions {
  sourceTimeout?: number; runTimeout?: number; signal?: AbortSignal
  env?: Record<string, string | undefined>; cache?: ClassifyCache; fetcher?: typeof fetch
  onCache?: (cache: ClassifyCache) => void
}
function failure(source: Source, e: unknown, timedOut: boolean): string {
  if (timedOut) return 'Se agotó el tiempo disponible para esta fuente.'
  if (source.apiKey) return 'No se pudo consultar la API protegida.'
  if (source.disabled) return 'Fuente desactivada; pendiente de revisión.'
  const message = e instanceof Error ? e.message : ''
  if (/Blocked by robots/.test(message)) return 'La fuente no permite la consulta automática.'
  if (/robots.txt/.test(message)) return 'No se pudo comprobar el permiso de consulta.'
  if (/Redirect refused/.test(message)) return 'La fuente redirige a otra dirección; pendiente de revisión.'
  if (/schema|XML|JSON/i.test(message)) return 'La fuente devolvió datos que no se pudieron interpretar.'
  return 'No se pudieron obtener las ofertas de esta fuente.'
}
export async function collect(sources: Source[], read: (source: Source, context?: RequestContext) => Promise<string>, now: Date, previous: Deal[] = [], options: CollectOptions = {}): Promise<DealsFile> {
  const run = new AbortController()
  const runTimer = setTimeout(() => run.abort(), options.runTimeout ?? 240000)
  const runSignal = options.signal ? AbortSignal.any([run.signal, options.signal]) : run.signal
  try {
    const settled = await Promise.allSettled(sources.map(async source => {
      const start = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), options.sourceTimeout ?? 45000)
      const signal = AbortSignal.any([runSignal, controller.signal])
      const found: Deal[] = []
      let requests = 0, error: string | undefined
      try {
        for (const page of source.pages || [{ url: source.url }]) {
          signal.throwIfAborted()
          const current = { ...source, ...page, pages: undefined }
          let counted = false
          const context = { signal, onRequest: () => { requests++; counted = true } }
          try {
            const raw = await bounded(read(current, context), signal)
            signal.throwIfAborted()
            const offers = normalizeSource(current, raw, now, previous)
            // Reject a credential-bearing page as a unit, even if an API echoes it.
            if (source.apiKey && JSON.stringify(offers).includes(source.apiKey)) throw new Error('Protected API response')
            found.push(...offers)
          } finally { if (!counted && !(read as typeof read & { tracksRequests?: boolean }).tracksRequests) requests++ }
        }
      } catch (e) { error = failure(source, e, signal.aborted) }
      finally { clearTimeout(timer) }
      const outcome: SourceOutcome = { name: source.name, ok: !error, count: found.length, requests, ms: Date.now() - start, direct: !!source.direct, ...(error ? { error, errorEs: error } : {}) }
      return { deals: found, outcome }
    }))
    const deals: Deal[] = [], outcomes: SourceOutcome[] = []
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') { deals.push(...r.value.deals); outcomes.push(r.value.outcome) }
      else outcomes.push({ name: sources[i]!.name, ok: false, count: 0, requests: 0, ms: 0, direct: !!sources[i]!.direct, error: 'No se pudo consultar la fuente.', errorEs: 'No se pudo consultar la fuente.' })
    })
    const old = new Map(previous.map(d => [d.id, d]))
    for (const d of deals) {
      const history = old.get(d.id)?.history
      if (history) d.history = history
      Object.assign(d, scoreDeal(d, now, history))
    }
    const classified = await classify(dedupe(deals), options.env || {}, now, options.cache, options.fetcher, runSignal)
    options.onCache?.(classified.cache)
    const all = dedupe(classified.deals.map(d => ({ ...d, ...scoreDeal(d, now) })))
    const ranked = balanceRanking(all).slice(0, 400)
    const file: DealsFile = { version: 2, date: now.toISOString().slice(0, 10), generatedAt: now.toISOString(), count: ranked.length, sources: outcomes, deals: ranked, ...(classified.classifier ? { classifier: classified.classifier } : {}) }
    retainCollected(file, all)
    return file
  } finally { clearTimeout(runTimer) }
}

// Alternate the best non-game and game offers; at most 15 games in the top 30
// when 15 other offers exist. Fill shortages instead of hiding valid offers.
export function balanceRanking(ranked: Deal[]): Deal[] {
  const games = ranked.filter(d => /videojuegos|games/i.test(d.category || ''))
  const other = ranked.filter(d => !/videojuegos|games/i.test(d.category || ''))
  const top: Deal[] = []
  for (let i = 0; i < 15; i++) {
    if (other[i]) top.push(other[i]!)
    if (games[i]) top.push(games[i]!)
  }
  const selected = new Set(top.map(d => d.id))
  return [...top, ...ranked.filter(d => !selected.has(d.id))]
}
