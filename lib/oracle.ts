// The .si oracle: "¿compra ahora o espera?", answered with a number that is scored later.
// Pure. Empirical Bayes on the price ledger: a Beta prior per category, fitted by method of
// moments across every tracked product, updated with the product's own history (beta-binomial).
// Every prediction is logged and resolved against the ledger once its horizon passes.
// See NOTES.md 2026-11-04 for the math in plain words.
import type { Deal, OracleFile, OraclePrediction, OracleScorecard, PriceLedger } from './types.ts'
import { categorize } from './categorize.ts'

export const ORACLE_MODEL = 'beta-binomial empirical Bayes v1'
export const HORIZON_DAYS = 14
export const DROP_THRESHOLD_PCT = 5
/** Own completed windows a product needs before the oracle answers for it. */
export const MIN_OWN_WINDOWS = 2
/** A category gets its own prior only with this much pooled evidence; else the global prior. */
export const MIN_CATEGORY_WINDOWS = 30
export const MIN_CATEGORY_PRODUCTS = 10
/** Below this the pooled data is too thin for any answer. */
export const MIN_GLOBAL_WINDOWS = 50
/** Prior strength alpha+beta is kept in [2, 50]: never certain from the pool, never ignored. */
export const STRENGTH_MIN = 2
export const STRENGTH_MAX = 50
export const STRENGTH_DEFAULT = 10
const MEAN_MIN = .02, MEAN_MAX = .98
const LOG_DAYS = 180, LOG_MAX = 20000

type Row = { d: string; p: number }
export interface Windows { n: number; k: number }
export interface Prior { alpha: number; beta: number; mean: number; windows: number; products: number }
export interface OracleModel { global: Prior | null; byCategory: Record<string, Prior>; own: Map<string, Windows> }
export interface OracleLogEntry {
  date: string; productKey: string; dealId: string; currency: string; price: number
  pDrop: number
  /** Pooled global rate known at prediction time: the naive baseline's forecast. */
  baseRate: number
  horizonDays: number; dropThresholdPct: number
  verdict: OraclePrediction['verdict']
  /** 1 dropped, 0 did not, null horizon passed with no later observation (excluded from scoring). Absent while open. */
  outcome?: 0 | 1 | null
  resolvedOn?: string
}
export interface OracleLog { version: 1; entries: OracleLogEntry[] }
export const emptyOracleLog = (): OracleLog => ({ version: 1, entries: [] })

const DAY = 86400000
const dayNum = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / DAY)
const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places
const dropped = (later: number, anchor: number, pct: number) => later <= round(anchor * (1 - pct / 100), 2) + 1e-9

/**
 * Completed, non-overlapping windows of one daily-low series. A window opens at an observed day t
 * and covers (t, t + horizon]. It counts only if the horizon has fully passed before `today` and at
 * least one later price was observed inside it. Success = some later price is >= pct below p(t).
 * The next window opens at the first observation after the previous one closed, so one long price
 * does not become many correlated trials.
 */
export function productWindows(series: Row[], today: string, horizon = HORIZON_DAYS, pct = DROP_THRESHOLD_PCT): Windows {
  const rows = [...series].filter(r => Number.isFinite(r.p) && r.p > 0).sort((a, b) => a.d.localeCompare(b.d))
  const end = dayNum(today)
  let n = 0, k = 0, i = 0
  while (i < rows.length) {
    const t = dayNum(rows[i]!.d)
    if (t + horizon >= end) break
    const later = rows.filter(r => dayNum(r.d) > t && dayNum(r.d) <= t + horizon)
    if (later.length) { n++; if (dropped(Math.min(...later.map(r => r.p)), rows[i]!.p, pct)) k++ }
    let j = i + 1
    while (j < rows.length && dayNum(rows[j]!.d) <= t + horizon) j++
    i = j
  }
  return { n, k }
}

/**
 * Method-of-moments Beta prior from per-product (n_i, k_i). Mean = sum k / sum n. The spread of
 * per-product rates around it, beyond binomial noise, gives the intra-class correlation
 * rho = 1 / (alpha + beta + 1):
 *   E[ sum n_i (k_i/n_i - mu)^2 ] = mu(1-mu) [ (N-1) + rho ( sum(n_i - 1) - sum n_i(n_i - 1) / sum n_i ) ]
 * Strength alpha+beta is clamped to [STRENGTH_MIN, STRENGTH_MAX]; when only single-window products
 * exist rho is not identifiable and STRENGTH_DEFAULT is used.
 */
export function fitPrior(groups: Windows[]): Prior | null {
  const g = groups.filter(w => w.n > 0)
  const N = g.length, T = g.reduce((s, w) => s + w.n, 0), K = g.reduce((s, w) => s + w.k, 0)
  if (!T) return null
  const raw = K / T
  const mean = Math.min(MEAN_MAX, Math.max(MEAN_MIN, raw))
  const S = g.reduce((s, w) => s + w.n * (w.k / w.n - raw) ** 2, 0)
  const denom = g.reduce((s, w) => s + (w.n - 1), 0) - g.reduce((s, w) => s + w.n * (w.n - 1), 0) / T
  let strength = STRENGTH_DEFAULT
  if (denom > 1e-9) {
    const rho = Math.min(1 / (STRENGTH_MIN + 1), Math.max(1 / (STRENGTH_MAX + 1), (S / (mean * (1 - mean)) - (N - 1)) / denom))
    strength = 1 / rho - 1
  }
  return { alpha: round(mean * strength, 4), beta: round((1 - mean) * strength, 4), mean: round(raw, 4), windows: T, products: N }
}

const usable = (key: string, entry: PriceLedger['products'][string] | undefined, d: Pick<Deal, 'title' | 'currency'>) =>
  !!entry && entry.currency === d.currency && (!key.startsWith('shopify:') || entry.title === d.title)

export function fitOracle(ledger: PriceLedger, today: string, horizon = HORIZON_DAYS, pct = DROP_THRESHOLD_PCT): OracleModel {
  const own = new Map<string, Windows>(), pooled = new Map<string, Windows[]>(), all: Windows[] = []
  for (const [key, entry] of Object.entries(ledger.products)) {
    const w = productWindows(entry.series, today, horizon, pct)
    if (!w.n) continue
    own.set(key, w); all.push(w)
    const category = categorize(entry.title, null, '')
    if (!pooled.has(category)) pooled.set(category, [])
    pooled.get(category)!.push(w)
  }
  const byCategory: Record<string, Prior> = {}
  for (const [category, groups] of pooled) {
    const prior = fitPrior(groups)
    if (prior && prior.windows >= MIN_CATEGORY_WINDOWS && prior.products >= MIN_CATEGORY_PRODUCTS) byCategory[category] = prior
  }
  return { global: fitPrior(all), byCategory, own }
}

export function predict(d: Deal, ledger: PriceLedger, model: OracleModel, horizon = HORIZON_DAYS): OraclePrediction | null {
  const key = d.productKey
  if (!key || !usable(key, ledger.products[key], d) || !(d.price > 0)) return null
  const own = model.own.get(key) || { n: 0, k: 0 }
  const category = typeof d.category === 'string' && model.byCategory[d.category] ? d.category : null
  const enough = !!model.global && model.global.windows >= MIN_GLOBAL_WINDOWS
  const prior = category ? model.byCategory[category]! : enough ? model.global! : { alpha: 1, beta: 1 }
  const pDrop = round((prior.alpha + own.k) / (prior.alpha + prior.beta + own.n), 3)
  const verdict = !enough || own.n < MIN_OWN_WINDOWS ? 'aprendiendo' : pDrop >= .5 ? 'espera' : 'compra'
  return {
    dealId: d.id, productKey: key, title: d.title, price: d.price, currency: d.currency, pDrop, horizonDays: horizon, verdict,
    basis: { observations: own.n, priorAlpha: prior.alpha, priorBeta: prior.beta, category },
  }
}

/** Close every open prediction whose horizon has passed, using the ledger's later daily lows. */
export function resolveLog(log: OracleLog, ledger: PriceLedger, today: string): OracleLog {
  const end = dayNum(today)
  return { version: 1, entries: log.entries.map(e => {
    if (e.outcome !== undefined || dayNum(e.date) + e.horizonDays >= end) return { ...e }
    const entry = ledger.products[e.productKey]
    const start = dayNum(e.date)
    const later = entry && entry.currency === e.currency ? entry.series.filter(r => r.p > 0 && dayNum(r.d) > start && dayNum(r.d) <= start + e.horizonDays) : []
    const outcome = later.length ? (dropped(Math.min(...later.map(r => r.p)), e.price, e.dropThresholdPct) ? 1 : 0) : null
    return { ...e, outcome, resolvedOn: today }
  }) }
}

/** One prediction per product per UTC day (the first run of the day); bounded by age and count. */
export function appendLog(log: OracleLog, predictions: OraclePrediction[], date: string, baseRate: number, pct = DROP_THRESHOLD_PCT): OracleLog {
  const seen = new Set(log.entries.filter(e => e.date === date).map(e => e.productKey))
  const entries = [...log.entries]
  for (const p of predictions) if (!seen.has(p.productKey)) {
    seen.add(p.productKey)
    entries.push({ date, productKey: p.productKey, dealId: p.dealId, currency: p.currency, price: p.price, pDrop: p.pDrop, baseRate, horizonDays: p.horizonDays, dropThresholdPct: pct, verdict: p.verdict })
  }
  const cutoff = dayNum(date) - LOG_DAYS
  return { version: 1, entries: entries.filter(e => dayNum(e.date) >= cutoff).sort((a, b) => a.date.localeCompare(b.date) || a.productKey.localeCompare(b.productKey)).slice(-LOG_MAX) }
}

export function scorecard(log: OracleLog): OracleScorecard {
  const done = log.entries.filter((e): e is OracleLogEntry & { outcome: 0 | 1 } => e.outcome === 0 || e.outcome === 1)
  const buckets = [0, 1, 2, 3, 4].map(i => {
    const lo = i / 5, hi = (i + 1) / 5
    const inside = done.filter(e => e.pDrop >= lo && (i === 4 ? e.pDrop <= hi : e.pDrop < hi))
    return { lo, hi, n: inside.length, hitRate: inside.length ? round(inside.reduce((s, e) => s + e.outcome, 0) / inside.length, 4) : null }
  })
  const brier = (f: (e: OracleLogEntry) => number) => done.length ? round(done.reduce((s, e) => s + (f(e) - e.outcome) ** 2, 0) / done.length, 4) : null
  return { resolved: done.length, brier: brier(e => e.pDrop), baselineBrier: brier(e => e.baseRate), buckets, since: done.length ? done.map(e => e.date).sort()[0]! : null }
}

/** One run: resolve old predictions, fit, predict for published deals the ledger tracks, log, score. */
export function buildOracle(deals: Deal[], ledger: PriceLedger, log: OracleLog, now: Date): { file: OracleFile; log: OracleLog } {
  const today = now.toISOString().slice(0, 10)
  const model = fitOracle(ledger, today)
  const seen = new Set<string>(), predictions: OraclePrediction[] = []
  for (const d of deals) {
    const p = predict(d, ledger, model)
    if (p && !seen.has(p.productKey)) { seen.add(p.productKey); predictions.push(p) }
  }
  predictions.sort((a, b) => b.pDrop - a.pDrop || b.basis.observations - a.basis.observations || a.dealId.localeCompare(b.dealId))
  const next = appendLog(resolveLog(log, ledger, today), predictions, today, model.global?.mean ?? .5)
  return {
    file: { version: 1, date: today, generatedAt: now.toISOString(), model: ORACLE_MODEL, horizonDays: HORIZON_DAYS, dropThresholdPct: DROP_THRESHOLD_PCT, predictions, scorecard: scorecard(next) },
    log: next,
  }
}
