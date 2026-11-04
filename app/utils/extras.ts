// The pipeline's optional files of 2026-11-04 (highlights.json, oracle.json,
// errors.json recent/nearest; types in lib/types.ts) and the normalizers that
// make a missing or malformed file read as "nothing", never as a broken page.
import type { HighlightSlot, HighlightsFile, OracleFile, OraclePrediction, OracleScorecard } from '../../lib/types'

export type { HighlightSlot, HighlightsFile, OracleFile, OraclePrediction }
export type OracleVerdict = OraclePrediction['verdict']
/** A calibration bucket after normalizing: only buckets with predictions, hitRate always a number. */
export interface OracleBucket { lo: number; hi: number; n: number; hitRate: number }

/** One card in a home carousel: a deal, or a Don Centavo rule. */
export type PromoItem =
  | { kind: 'deal'; deal: import('../composables/useDeals').DealView }
  | { kind: 'lore'; id: string; n?: number; text: string }

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
    },
  }
}

/** Bucket bounds may come as 0-1 or 0-100; read them as whole percents. */
export function bucketPct(v: number): number {
  return Math.round(v <= 1 ? v * 100 : v)
}
