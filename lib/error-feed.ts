// Context for errors.json, so an empty day is not a dead end and the threshold never moves.
// `recent`: what the published archives called a candidate (errorScore >= 40) in the last 30 days.
// `nearest`: today's highest scores BELOW the threshold, a different list by construction.
import type { Deal } from './types.ts'
import { productKey } from './identity.ts'
import { isGame } from './interest.ts'
import { scoreDeal } from './rank.ts'
import { categorize } from './categorize.ts'

export const ERROR_THRESHOLD = 40
export const RECENT_DAYS = 30
export const RECENT_MAX = 50
export const NEAREST_MAX = 5
const DAY = 86400000

/**
 * Archives are the published day files; `today` itself is excluded (that is `deals`). Newest first, one per product.
 * Each archived row is re-scored by today's rules (lib/rank.ts, at its own day, with its stored history) and kept
 * only if it still reaches 40: a candidate the engine has since retracted (v2's noname list-price rows, retired
 * on 2026-11-02) is not shown as a past error. The published score and signals are the re-scored ones.
 */
export function recentCandidates(archives: { date: string; deals: Deal[] }[], today: string, exclude: Deal[] = []): { date: string; deal: Deal }[] {
  const cutoff = new Date(Date.parse(today + 'T00:00:00Z') - RECENT_DAYS * DAY).toISOString().slice(0, 10)
  const keyOf = (d: Deal) => (d.productKey || productKey(d)) + ':' + d.currency
  const seen = new Set(exclude.map(keyOf)), ids = new Set(exclude.map(d => d.id))
  const out: { date: string; deal: Deal }[] = []
  for (const file of [...archives].filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.date >= cutoff && f.date < today).sort((a, b) => b.date.localeCompare(a.date))) {
    const at = new Date(file.date + 'T12:00:00Z')
    const candidates = (file.deals || []).filter(d => typeof d?.id === 'string' && Number.isFinite(d.price) && (d.errorScore ?? 0) >= ERROR_THRESHOLD)
      .map(d => { const c = { ...d, category: categorize(d.title, d.category, d.store) }; return { ...c, ...scoreDeal(c, at, c.history) } })
      .filter(d => d.errorScore >= ERROR_THRESHOLD && !isGame(d))
      .sort((a, b) => b.errorScore - a.errorScore || a.id.localeCompare(b.id))
    for (const d of candidates) {
      const key = keyOf(d)
      if (seen.has(key) || ids.has(d.id)) continue
      seen.add(key); ids.add(d.id)
      out.push({ date: file.date, deal: { ...d, errorSignals: d.errorSignals ?? [], storeUrl: d.storeUrl ?? null, storeDomain: d.storeDomain ?? null } })
    }
  }
  return out.slice(0, RECENT_MAX)
}

/** Today's closest calls: non-game, 0 < errorScore < 40, strongest first. */
export function nearestMisses(deals: Deal[]): Deal[] {
  return deals.filter(d => !isGame(d) && d.errorScore > 0 && d.errorScore < ERROR_THRESHOLD)
    .sort((a, b) => b.errorScore - a.errorScore || b.score - a.score || a.id.localeCompare(b.id)).slice(0, NEAREST_MAX)
}
