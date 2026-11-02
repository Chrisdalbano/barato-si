import { categorize } from '../lib/categorize.ts'
import { productKey, brandOf, isDirect } from '../lib/identity.ts'
import { emptyLedger, mergeLedger, ledgerHistory } from '../lib/ledger.ts'
import { resolveReference, type CuratedPrice } from '../lib/reference.ts'
import { applyGate, diversify, isGame, rankValue } from '../lib/interest.ts'
import type { Deal, DealsFile, SourceOutcome, PriceLedger } from '../lib/types.ts'
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
  ledger?: PriceLedger; curated?: CuratedPrice[]
  onLedger?: (ledger: PriceLedger) => void
  onCollected?: (offers: Deal[]) => void
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
    const fresh = [...deals]
    const ledger = options.ledger || emptyLedger(now)
    options.onLedger?.(mergeLedger(ledger, fresh, now))
    carryOver(outcomes, deals, options.latest, now, options.reuseWindow ?? 14 * 3600000)
    const old = new Map(previous.map(d => [d.id, d]))
    const seenIn = new Map<string, Set<string>>()
    for (const d of deals) {
      d.productKey = productKey(d)
      const key = d.productKey + ':' + d.currency
      if (!seenIn.has(key)) seenIn.set(key, new Set())
      seenIn.get(key)!.add(d.source)
    }
    for (const d of deals) {
      d.category = categorize(d.title, d.category, d.store)
      d.productKey = productKey(d)
      d.brand = brandOf(d.title)
      d.direct = isDirect(d)
      d.seenIn = [...seenIn.get(d.productKey + ':' + d.currency)!]
      d.reference = resolveReference(d, deals, ledger, options.curated || [], now)
      d.referenceDiscountPct = d.reference ? Math.max(0, Math.round((1-d.price/d.reference.price)*10000)/100) : null
      const history = options.ledger ? ledgerHistory(d, ledger, now) : old.get(d.id)?.history
      delete d.history
      if (history) d.history = history
      Object.assign(d, scoreDeal(d, now, history))
    }
    const classified = await classify(dedupe(deals), options.env || {}, now, options.cache, options.fetcher, runSignal)
    options.onCache?.(classified.cache)
    const all = dedupe(classified.deals.map(d => ({ ...d, ...scoreDeal(d, now) })))
    options.onCollected?.(fresh)
    const { kept, gate } = applyGate(all)
    const ranked = balanceRanking(kept, now).slice(0, 250)
    const capped = kept.length - ranked.length
    gate.rejected += capped
    if (capped) gate.byReason['publication-cap'] = capped
    gate.published = ranked.length
    const file: DealsFile = { version: 3, gate, date: now.toISOString().slice(0, 10), generatedAt: now.toISOString(), count: ranked.length, sources: outcomes, deals: ranked, ...(classified.classifier ? { classifier: classified.classifier } : {}) }
    retainCollected(file, kept)
    return file
  } finally { clearTimeout(runTimer) }
}

// Candidates first; direct merchant links before intermediaries; games always last.
export const ERROR_CANDIDATE = 40
export function balanceRanking(ranked: Deal[], now = new Date()): Deal[] {
  const value = new Map(ranked.map(d => [d.id, rankValue(d, now)]))
  const candidate = (d: Deal) => !isGame(d) && d.errorScore >= ERROR_CANDIDATE
  const lead = ranked.filter(candidate).sort((a, b) => b.errorScore - a.errorScore || value.get(b.id)! - value.get(a.id)! || a.id.localeCompare(b.id))
  const byValue = (a: Deal, b: Deal) => Number(!!b.direct) - Number(!!a.direct) || value.get(b.id)! - value.get(a.id)! || b.score - a.score || a.id.localeCompare(b.id)
  const rest = ranked.filter(d => !candidate(d) && !isGame(d)).sort(byValue)
  const games = ranked.filter(isGame).sort(byValue)
  return [...lead, ...diversify(rest), ...games]
}
