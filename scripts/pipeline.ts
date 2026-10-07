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
  /** The currently published file, so a source blocked this run can carry its recent offers over. */
  latest?: Pick<DealsFile, 'generatedAt' | 'sources' | 'deals'>
  /** Max age of `latest` for carry-over, ms. Default 14 h. */
  reuseWindow?: number
}
const clock = (iso: string) => new Date(iso).toISOString().slice(11, 16) + ' UTC'
// A publisher that challenges the CI runner's IP (Cloudflare) but answers the
// owner's machine would otherwise vanish twice a day. Carry its offers from the
// published file when that run is recent, and say so in the outcome. The age is
// measured from the ORIGINAL fetch, so carry-overs cannot chain past the window.
function carryOver(outcomes: SourceOutcome[], deals: Deal[], latest: CollectOptions['latest'], now: Date, window: number): void {
  if (!latest) return
  for (const o of outcomes) {
    if (o.ok || o.count > 0) continue
    const origin = latest.sources.find(s => s.name === o.name)?.reusedFrom || latest.generatedAt
    const age = now.getTime() - Date.parse(origin)
    if (!(age >= 0 && age <= window)) continue
    const kept = latest.deals.filter(d => d.source === o.name)
    if (!kept.length) continue
    deals.push(...kept.map(d => ({ ...d, errorSignals: [...d.errorSignals], reasons: [...d.reasons] })))
    o.ok = true; o.count = kept.length; o.reusedFrom = origin
    o.errorEs = `Ofertas reutilizadas de la actualización de las ${clock(origin)}: la fuente no respondió esta vez.`
  }
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
// English diagnostic for operators (published in `error`, printed by the CLI).
// Keyed sources never expose their message: a provider may echo the credential.
function diagnostic(source: Source, e: unknown, timedOut: boolean): string {
  if (timedOut) return 'Source deadline exceeded'
  if (source.apiKey) return 'Protected API failure'
  const message = e instanceof Error ? e.message : 'Unknown source failure'
  return message.replace(/\s+/g, ' ').slice(0, 200)
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
      let requests = 0, error: string | undefined, errorEs: string | undefined
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
      } catch (e) { errorEs = failure(source, e, signal.aborted); error = diagnostic(source, e, signal.aborted) }
      finally { clearTimeout(timer) }
      const outcome: SourceOutcome = { name: source.name, ok: !error, count: found.length, requests, ms: Date.now() - start, direct: !!source.direct, ...(error ? { error, errorEs } : {}) }
      return { deals: found, outcome }
    }))
    const deals: Deal[] = [], outcomes: SourceOutcome[] = []
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') { deals.push(...r.value.deals); outcomes.push(r.value.outcome) }
      else outcomes.push({ name: sources[i]!.name, ok: false, count: 0, requests: 0, ms: 0, direct: !!sources[i]!.direct, error: 'Source task rejected', errorEs: 'No se pudo consultar la fuente.' })
    })
    carryOver(outcomes, deals, options.latest, now, options.reuseWindow ?? 14 * 3600000)
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

// Games are the boring part (owner, 2026-10-07): 90%-off games are routine and
// price errors live elsewhere. Publish three non-game offers for every game,
// so the 400-item cap holds about 100 games. Shortages fill from the other
// pool instead of hiding offers; a games-only list is returned unchanged.
export const GAMES_EVERY = 4
export function balanceRanking(ranked: Deal[]): Deal[] {
  const isGame = (d: Deal) => /videojuegos|games/i.test(d.category || '')
  const games = ranked.filter(isGame)
  const other = ranked.filter(d => !isGame(d))
  const out: Deal[] = []
  let o = 0, g = 0
  while (o < other.length || g < games.length) {
    for (let k = 0; k < GAMES_EVERY - 1 && o < other.length; k++) out.push(other[o++]!)
    if (g < games.length) out.push(games[g++]!)
  }
  return out
}
