// The pipeline's optional files of 2026-11-04 (highlights.json, oracle.json,
// errors.json recent/nearest; types in lib/types.ts) and the normalizers that
// make a missing or malformed file read as "nothing", never as a broken page.
import type { HighlightSlot, HighlightsFile, OracleFile, OraclePrediction, OracleScorecard, WeekDeal, WeekFile } from '../../lib/types'

export type { HighlightSlot, HighlightsFile, OracleFile, OraclePrediction, WeekFile }
export type OracleVerdict = OraclePrediction['verdict']
/** A calibration bucket after normalizing: only buckets with predictions, hitRate always a number. */
export interface OracleBucket { lo: number; hi: number; n: number; hitRate: number }

/** One card in a home carousel: a deal, or a Don Centavo rule. */
export type PromoItem =
  | { kind: 'deal'; deal: import('../composables/useDeals').DealView }
  | { kind: 'lore'; id: string; n?: number; text: string }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function normalizeHighlights(raw: unknown): HighlightsFile | null {
  if (!isObj(raw) || !Array.isArray(raw.slots)) return null
  const slots = raw.slots.flatMap((s): HighlightSlot[] => {
    if (!isObj(s) || !Array.isArray(s.dealIds)) return []
    const dealIds = s.dealIds.filter((d): d is string => typeof d === 'string' && !!d)
    const titleEs = str(s.titleEs)
    if (!dealIds.length || !titleEs) return []
    return [{ id: str(s.id) || titleEs, titleEs, titleEn: str(s.titleEn) || titleEs, noteEs: str(s.noteEs), noteEn: str(s.noteEn), dealIds }]
  })
  return slots.length ? { version: 1, date: str(raw.date), generatedAt: str(raw.generatedAt), slots } : null
}

const VERDICTS: OracleVerdict[] = ['espera', 'compra', 'aprendiendo']

export function normalizeOracle(raw: unknown): OracleFile | null {
  if (!isObj(raw)) return null
  const horizonDays = fin(raw.horizonDays) && raw.horizonDays > 0 ? raw.horizonDays : 14
  const predictions = (Array.isArray(raw.predictions) ? raw.predictions : []).flatMap((p): OraclePrediction[] => {
    if (!isObj(p) || !str(p.dealId) || !fin(p.pDrop) || !fin(p.price)) return []
    const verdict = VERDICTS.includes(p.verdict as OracleVerdict) ? p.verdict as OracleVerdict : 'aprendiendo'
    const b = isObj(p.basis) ? p.basis : {}
    return [{
      dealId: str(p.dealId), productKey: str(p.productKey), title: str(p.title), price: p.price, currency: str(p.currency) || 'USD',
      pDrop: Math.max(0, Math.min(1, p.pDrop)), horizonDays: fin(p.horizonDays) && p.horizonDays > 0 ? p.horizonDays : horizonDays, verdict,
      basis: { observations: fin(b.observations) ? b.observations : 0, priorAlpha: fin(b.priorAlpha) ? b.priorAlpha : 0, priorBeta: fin(b.priorBeta) ? b.priorBeta : 0, category: str(b.category) || null },
    }]
  })
  const sc = isObj(raw.scorecard) ? raw.scorecard : {}
  const buckets = (Array.isArray(sc.buckets) ? sc.buckets : []).flatMap((b): OracleBucket[] =>
    isObj(b) && fin(b.lo) && fin(b.hi) && fin(b.n) && fin(b.hitRate) && b.n > 0 ? [{ lo: b.lo, hi: b.hi, n: b.n, hitRate: Math.max(0, Math.min(1, b.hitRate)) }] : [])
  return {
    version: 1, date: str(raw.date), generatedAt: str(raw.generatedAt), model: str(raw.model),
    horizonDays, dropThresholdPct: fin(raw.dropThresholdPct) && raw.dropThresholdPct > 0 ? raw.dropThresholdPct : 5,
    predictions,
    scorecard: <OracleScorecard>{
      resolved: fin(sc.resolved) && sc.resolved > 0 ? sc.resolved : 0,
      brier: fin(sc.brier) ? sc.brier : null,
      baselineBrier: fin(sc.baselineBrier) ? sc.baselineBrier : null,
      buckets,
      since: str(sc.since) || null,
      firstDue: DAY_RE.test(str(sc.firstDue)) ? str(sc.firstDue) : null,
    },
  }
}

/** Bucket bounds may come as 0-1 or 0-100; read them as whole percents. */
export function bucketPct(v: number): number {
  return Math.round(v <= 1 ? v * 100 : v)
}

const HTTP_RE = /^https?:\/\//
function weekDeal(v: unknown): WeekDeal | null {
  if (!isObj(v) || !str(v.id) || !str(v.title) || !HTTP_RE.test(str(v.url))) return null
  return {
    id: str(v.id), title: str(v.title), store: str(v.store), url: str(v.url),
    storeUrl: HTTP_RE.test(str(v.storeUrl)) ? str(v.storeUrl) : null,
    image: str(v.image).startsWith('https://') ? str(v.image) : null,
    currency: str(v.currency) || 'USD', category: str(v.category) || null,
  }
}
/** Rows whose deal is malformed are dropped; a list that is missing reads as empty, never as a broken page. */
function rowsOf<T>(raw: unknown, map: (row: Record<string, unknown>, deal: WeekDeal) => T | null): T[] {
  return (Array.isArray(raw) ? raw : []).flatMap((r) => {
    if (!isObj(r)) return []
    const deal = weekDeal(r.deal)
    const row = deal ? map(r, deal) : null
    return row ? [row] : []
  })
}

/** public/api/week.json (lib/types.ts WeekFile), or null when absent or malformed. */
export function normalizeWeek(raw: unknown): WeekFile | null {
  if (!isObj(raw) || raw.version !== 1 || !DAY_RE.test(str(raw.from)) || !DAY_RE.test(str(raw.to))) return null
  const n = (v: unknown) => (fin(v) && v >= 0 ? v : 0)
  const f = isObj(raw.forecast) ? raw.forecast : {}
  const rule = isObj(raw.rule) ? raw.rule : {}
  const card = isObj(f.scorecard) ? normalizeOracle({ scorecard: f.scorecard })?.scorecard ?? null : null
  return {
    version: 1, generatedAt: str(raw.generatedAt), from: str(raw.from), to: str(raw.to), isoWeek: str(raw.isoWeek),
    days: n(raw.days), products: n(raw.products),
    drops: rowsOf(raw.drops, (r, deal) => fin(r.before) && fin(r.after) && fin(r.pct) && DAY_RE.test(str(r.beforeDate)) && DAY_RE.test(str(r.afterDate))
      ? { deal, before: r.before, beforeDate: str(r.beforeDate), after: r.after, afterDate: str(r.afterDate), pct: r.pct } : null),
    lows: rowsOf(raw.lows, (r, deal) => fin(r.price) && fin(r.priorLow) && fin(r.priorHigh) && fin(r.priorDays) && DAY_RE.test(str(r.date))
      ? { deal, price: r.price, date: str(r.date), priorDays: r.priorDays, priorLow: r.priorLow, priorHigh: r.priorHigh } : null),
    errors: rowsOf(raw.errors, (r, deal) => fin(r.price) && fin(r.errorScore) && DAY_RE.test(str(r.date))
      ? { deal, date: str(r.date), price: r.price, errorScore: r.errorScore, signals: (Array.isArray(r.signals) ? r.signals : []).filter((x): x is string => typeof x === 'string'), note: str(r.note) || null } : null),
    forecast: {
      predictions: n(f.predictions), espera: n(f.espera), compra: n(f.compra), aprendiendo: n(f.aprendiendo),
      logged: n(f.logged), resolved: n(f.resolved), dropped: n(f.dropped),
      firstDue: DAY_RE.test(str(f.firstDue)) ? str(f.firstDue) : null,
      scorecard: card && card.resolved > 0 ? card : null,
    },
    rule: { n: n(rule.n), es: str(rule.es), en: str(rule.en) },
  }
}
