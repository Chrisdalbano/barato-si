import type { Deal } from '../lib/types.ts'
import { asinFrom } from '../lib/identity.ts'
import { scoreDeal } from '../lib/rank.ts'
import { parseCamel } from './watch.ts'
import type { Source } from '../lib/normalize.ts'
import type { RequestContext } from './network.ts'

const MAX_CHECKS = 15
const TOLERANCE = .03
type Read = (source: Source, context?: RequestContext) => Promise<string>

/**
 * A price error is only worth flagging if the price is still there. Each Amazon
 * candidate is looked up once on its public CamelCamelCamel page before publishing.
 * A row whose page has no current price is dropped; a moved price is corrected and
 * rescored. A failed lookup changes nothing and says so. Few rows, one request each.
 */
export async function verifyCandidates(deals: Deal[], read: Read, now: Date, signal?: AbortSignal): Promise<Deal[]> {
  const candidates = deals.filter(d => d.category !== 'videojuegos' && d.errorScore >= 40 && asinFrom(d.storeUrl || d.url)).slice(0, MAX_CHECKS)
  const gone = new Set<string>()
  for (const d of candidates) {
    const url = 'https://camelcamelcamel.com/product/' + asinFrom(d.storeUrl || d.url)
    let rows: ReturnType<typeof parseCamel>
    try { rows = parseCamel(await read({ name: 'CamelCamelCamel', kind: 'rss', url }, { signal: signal ?? AbortSignal.timeout(30000) }), url, now.toISOString()) }
    catch { d.errorSignals = [...d.errorSignals, 'Precio actual sin comprobar']; continue }
    if (!rows.length) { d.errorSignals = [...d.errorSignals, 'Precio actual sin comprobar']; continue }
    const prices = rows.map(r => r.price).filter((p): p is number => typeof p === 'number')
    if (!prices.length) { gone.add(d.id); continue }
    const current = Math.min(...prices)
    if (Math.abs(current - d.price) <= d.price * TOLERANCE) { d.errorSignals = [...d.errorSignals, 'Precio confirmado en CamelCamelCamel']; continue }
    d.price = current
    if (d.reference) d.referenceDiscountPct = Math.max(0, Math.round((1 - current / d.reference.price) * 10000) / 100)
    Object.assign(d, scoreDeal(d, now, d.history))
    d.errorSignals = [...d.errorSignals, 'Precio corregido con CamelCamelCamel: el publicado ya no estaba']
  }
  return deals.filter(d => !gone.has(d.id))
}
