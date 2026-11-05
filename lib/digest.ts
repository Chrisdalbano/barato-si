// "La semana de Don Centavo": the weekly digest, rebuilt on every run from the last 7 UTC days of
// published archives (today included), the price ledger, the oracle and its log. Pure and
// deterministic. The copy is templated here, in both languages, so the RSS item (/semana.xml)
// and the page (/semana, /en/week) say the same thing in the same words. No model writes it.
//
// Honesty rules, the same as the rest of the index: every list may be empty and says so; nothing
// is loosened to fill one; drops and lows are measured against prices we observed, never a list
// price; past error candidates are re-scored by today's rules before they are repeated.
import type { Deal, OracleFile, PriceLedger, WeekDeal, WeekFile } from './types.ts'
import type { OracleLog } from './oracle.ts'
import type { ClassifyCache } from './classify.ts'
import { productKey } from './identity.ts'
import { recentCandidates } from './error-feed.ts'
import { HOUSE_RULES_EN, HOUSE_RULES_ES } from './don-centavo.ts'

export const WEEK_DAYS = 7
/** A drop counts at 10 % or more against the previous observed day: the home carousel's rule too. */
export const DROP_MIN_PCT = 10
/** A low needs this many observed days before it, in a series that moved at least LOW_MOVE_PCT. */
export const LOW_MIN_DAYS = 3
export const LOW_MOVE_PCT = 5
export const LIST_MAX = 8
const NOTE_MAX = 220

const DAY = 86400000
const dayNum = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / DAY)
const isoDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
const pct1 = (v: number) => Math.round(v * 1000) / 10

/** ISO 8601 week of a UTC day: "2026-W45". */
export function isoWeek(day: string): string {
  const d = new Date(day + 'T00:00:00Z')
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / DAY + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function weekDeal(d: Deal): WeekDeal {
  return {
    id: d.id, title: d.title, store: d.store, url: d.url, storeUrl: d.storeUrl ?? null,
    image: typeof d.image === 'string' && d.image.startsWith('https://') ? d.image : null,
    currency: d.currency, category: typeof d.category === 'string' ? d.category : null,
  }
}

const keyOf = (d: Deal) => d.productKey || productKey(d)

/** The ledger series that describes this deal, or [] when it is not the same product (currency, Shopify variant). */
function seriesOf(d: Deal, ledger: PriceLedger): { d: string; p: number }[] {
  const key = keyOf(d), entry = ledger.products[key]
  if (!entry || entry.currency !== d.currency || (key.startsWith('shopify:') && entry.title !== d.title)) return []
  return entry.series.filter(r => Number.isFinite(r.p) && r.p > 0).sort((a, b) => a.d.localeCompare(b.d))
}

export interface DigestInput {
  /** Published day archives; anything outside the window is ignored. Today's list goes here too. */
  archives: { date: string; deals: Deal[] }[]
  ledger: PriceLedger
  oracle?: OracleFile | null
  log?: OracleLog | null
  cache?: ClassifyCache | null
  now: Date
}

export function buildWeek(input: DigestInput): WeekFile {
  const to = input.now.toISOString().slice(0, 10)
  const from = isoDay(dayNum(to) - (WEEK_DAYS - 1))
  const files = input.archives.filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.date >= from && f.date <= to && Array.isArray(f.deals))
    .sort((a, b) => a.date.localeCompare(b.date))
  // Several entries for the same day (the archive plus today's list) count once; the later wins.
  const byDay = new Map<string, Deal[]>()
  for (const f of files) byDay.set(f.date, f.deals)
  const days = [...byDay].sort((a, b) => a[0].localeCompare(b[0]))

  // Every published appearance, and the latest one per product (for the link and picture).
  const latest = new Map<string, { date: string; deal: Deal }>()
  const seen: { date: string; deal: Deal }[] = []
  for (const [date, deals] of days) for (const d of deals) {
    if (!d || typeof d.id !== 'string' || !Number.isFinite(d.price) || d.price <= 0) continue
    seen.push({ date, deal: d })
    latest.set(keyOf(d) + ':' + d.currency, { date, deal: d })
  }

  // Drops: for each product published this week, the largest fall inside the window against the
  // previous day we observed it (any day before, published or only collected).
  const drops: WeekFile['drops'] = []
  for (const { deal } of latest.values()) {
    const rows = seriesOf(deal, input.ledger)
    let best: WeekFile['drops'][number] | null = null
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]!, prev = rows[i - 1]!
      if (r.d < from || r.d > to) continue
      const pct = pct1(1 - r.p / prev.p)
      if (pct >= DROP_MIN_PCT && (!best || pct > best.pct)) best = { deal: weekDeal(deal), before: prev.p, beforeDate: prev.d, after: r.p, afterDate: r.d, pct }
    }
    if (best) drops.push(best)
  }
  drops.sort((a, b) => b.pct - a.pct || a.deal.id.localeCompare(b.deal.id))

  // Lows: a published price at or below every one of >= 3 earlier observed days, in a series that
  // moved. The latest qualifying day per product.
  const lowByKey = new Map<string, WeekFile['lows'][number]>()
  for (const { date, deal } of seen) {
    const prior = seriesOf(deal, input.ledger).filter(r => r.d < date)
    if (prior.length < LOW_MIN_DAYS) continue
    const lo = Math.min(...prior.map(r => r.p)), hi = Math.max(...prior.map(r => r.p))
    if (deal.price > lo + 1e-9 || hi < lo * (1 + LOW_MOVE_PCT / 100)) continue
    const key = keyOf(deal) + ':' + deal.currency, had = lowByKey.get(key)
    if (!had || had.date <= date) lowByKey.set(key, { deal: weekDeal(deal), price: deal.price, date, priorDays: prior.length, priorLow: lo, priorHigh: hi })
  }
  const lows = [...lowByKey.values()].sort((a, b) => (1 - b.price / b.priorHigh) - (1 - a.price / a.priorHigh) || a.deal.id.localeCompare(b.deal.id))

  // Error candidates of the week, re-scored by today's rules (lib/error-feed.ts), one per product.
  const tomorrow = isoDay(dayNum(to) + 1)
  const errors: WeekFile['errors'] = recentCandidates(days.map(([date, deals]) => ({ date, deals })), tomorrow)
    .filter(r => r.date >= from)
    .map(({ date, deal }) => {
      const raw = deal.ai?.note || input.cache?.[deal.id]?.ai?.note || ''
      const note = raw.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX)
      return { deal: weekDeal(deal), date, price: deal.price, errorScore: deal.errorScore, signals: deal.errorSignals.slice(0, 3), note: note || null }
    })

  // What the forecast learned: today's verdicts, this week's log activity, the scorecard once graded.
  const preds = input.oracle?.predictions ?? []
  const count = (v: string) => preds.filter(p => p.verdict === v).length
  const entries = input.log?.entries ?? []
  const resolvedIn = entries.filter(e => (e.outcome === 0 || e.outcome === 1) && !!e.resolvedOn && e.resolvedOn >= from && e.resolvedOn <= to)
  const open = entries.filter(e => e.outcome === undefined).map(e => isoDay(dayNum(e.date) + e.horizonDays + 1)).sort()
  const card = input.oracle?.scorecard
  const forecast: WeekFile['forecast'] = {
    predictions: preds.length, espera: count('espera'), compra: count('compra'), aprendiendo: count('aprendiendo'),
    logged: entries.filter(e => e.date >= from && e.date <= to).length,
    resolved: resolvedIn.length, dropped: resolvedIn.filter(e => e.outcome === 1).length,
    firstDue: open[0] ?? card?.firstDue ?? null,
    scorecard: card && card.resolved > 0 ? { ...card } : null,
  }

  const week = isoWeek(to)
  const n = (Number(week.slice(-2)) % HOUSE_RULES_ES.length)
  return {
    version: 1, generatedAt: input.now.toISOString(), from, to, isoWeek: week,
    days: days.length, products: latest.size,
    drops: drops.slice(0, LIST_MAX), lows: lows.slice(0, LIST_MAX), errors: errors.slice(0, LIST_MAX),
    forecast,
    rule: { n: n + 1, es: HOUSE_RULES_ES[n]!, en: HOUSE_RULES_EN[n]! },
  }
}

// ---- The copy ----------------------------------------------------------------------------------

type Loc = 'es' | 'en'
const TAG: Record<Loc, string> = { es: 'es-ES', en: 'en-US' }
const nf = (loc: Loc, o: Intl.NumberFormatOptions = {}) => new Intl.NumberFormat(TAG[loc], o)
export function money(v: number, currency: string, loc: Loc): string {
  try { return nf(loc, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) } catch { return `${v.toFixed(2)} ${currency}` }
}
export function dayMonth(day: string, loc: Loc): string {
  return new Intl.DateTimeFormat(TAG[loc], { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(day + 'T12:00:00Z')).replace('.', '')
}
const pctText = (v: number, loc: Loc) => nf(loc, { maximumFractionDigits: 1 }).format(v) + (loc === 'es' ? ' %' : '%')
const num = (v: number, loc: Loc) => nf(loc).format(v)
const plural = (n: number, one: string, many: string, loc: Loc) => `${num(n, loc)} ${n === 1 ? one : many}`

export interface WeekCopy {
  title: string
  range: string
  lede: string
  /** Set when the week is short or quiet; says so plainly. */
  thin: string | null
  drops: { title: string; note: string; empty: string }
  lows: { title: string; note: string; empty: string }
  errors: { title: string; note: string; empty: string; notePrefix: string }
  forecast: { title: string; lines: string[] }
  rule: string
  signature: string
}

/** Every sentence of the digest in one language. Data-dependent, so it is a function of the file. */
export function weekCopy(w: WeekFile, loc: Loc): WeekCopy {
  const es = loc === 'es'
  const range = `${dayMonth(w.from, loc)} – ${dayMonth(w.to, loc)}`
  const short = w.days < WEEK_DAYS
  const quiet = !w.drops.length && !w.lows.length && !w.errors.length
  const thin = [
    short ? (es ? `Semana corta: solo hay ${plural(w.days, 'día publicado', 'días publicados', loc)} en esta ventana. Lo que sigue es lo que hay.` : `A short week: only ${plural(w.days, 'published day', 'published days', loc)} in this window. What follows is what there is.`) : '',
    quiet ? (es ? 'Una semana tranquila: ninguna caída del 10 %, ningún mínimo, ningún error que aguante la revisión. También es un dato.' : 'A quiet week: no 10% drop, no new low, no error that survives review. That is data too.') : '',
  ].filter(Boolean).join(' ') || null

  const f = w.forecast, lines: string[] = []
  if (f.predictions) lines.push(es
    ? `Hoy el modelo mira ${plural(f.predictions, 'producto', 'productos', loc)}: ${num(f.espera, loc)} «espera», ${num(f.compra, loc)} «compra» y ${num(f.aprendiendo, loc)} «aprendiendo».`
    : `Today the model looks at ${plural(f.predictions, 'product', 'products', loc)}: ${num(f.espera, loc)} "wait", ${num(f.compra, loc)} "buy" and ${num(f.aprendiendo, loc)} "learning".`)
  else lines.push(es ? 'Hoy el modelo no ha publicado predicciones.' : 'The model published no predictions today.')
  if (f.logged) lines.push(es ? `Esta semana anotó ${plural(f.logged, 'predicción', 'predicciones', loc)} para ponerse nota.` : `This week it logged ${plural(f.logged, 'prediction', 'predictions', loc)} to grade itself on.`)
  if (f.resolved) lines.push(es
    ? `Vencieron ${plural(f.resolved, 'predicción', 'predicciones', loc)} esta semana; en ${num(f.dropped, loc)} llegó la bajada.`
    : `${plural(f.resolved, 'prediction', 'predictions', loc)} came due this week; the drop arrived in ${num(f.dropped, loc)}.`)
  const sc = f.scorecard
  if (sc && sc.brier !== null) {
    const b = num(Math.round(sc.brier * 1000) / 1000, loc), base = sc.baselineBrier === null ? null : num(Math.round(sc.baselineBrier * 1000) / 1000, loc)
    const better = sc.baselineBrier !== null && sc.brier < sc.baselineBrier
    lines.push(es
      ? `La nota acumulada: Brier ${b}${base ? ` contra ${base} de la línea base. ${better ? 'Mejor que la línea base.' : 'Peor que la línea base, y lo decimos igual.'}` : '.'} ${plural(sc.resolved, 'predicción resuelta', 'predicciones resueltas', loc)}.`
      : `The running grade: Brier ${b}${base ? ` against ${base} for the baseline. ${better ? 'Better than the baseline.' : 'Worse than the baseline, and we say so.'}` : '.'} ${plural(sc.resolved, 'prediction resolved', 'predictions resolved', loc)}.`)
  } else if (f.firstDue) {
    lines.push(es ? `Todavía no ha vencido ninguna. Las primeras notas llegan el ${dayMonth(f.firstDue, loc)}.` : `None has come due yet. The first grades arrive on ${dayMonth(f.firstDue, loc)}.`)
  } else {
    lines.push(es ? 'Todavía no hay nada que calificar.' : 'Nothing to grade yet.')
  }

  return {
    title: es ? 'La semana de Don Centavo' : "Don Centavo's week",
    range,
    lede: es
      ? `Los últimos siete días de barato.si en una página: lo que bajó de verdad, lo que tocó su mínimo, los posibles errores y lo que aprendió el modelo. ${plural(w.products, 'producto publicado', 'productos publicados', loc)} en ${plural(w.days, 'día', 'días', loc)}. Todo sale de precios que observamos; nada se rellena.`
      : `The last seven days of barato.si on one page: what really dropped, what hit its low, the possible errors and what the model learned. ${plural(w.products, 'product published', 'products published', loc)} over ${plural(w.days, 'day', 'days', loc)}. All of it from prices we observed; nothing is padded.`,
    thin,
    drops: {
      title: es ? 'Las caídas de la semana' : 'The week\'s drops',
      note: es ? `Productos publicados esta semana cuyo precio bajó al menos un ${DROP_MIN_PCT} % frente al día anterior en que lo vimos. Evidencia propia, no el precio de lista.` : `Products published this week whose price fell at least ${DROP_MIN_PCT}% against the previous day we saw them. Our own evidence, not a list price.`,
      empty: es ? `Ninguna caída del ${DROP_MIN_PCT} % o más esta semana. No bajamos el listón para tener lista.` : `No drop of ${DROP_MIN_PCT}% or more this week. We do not lower the bar to have a list.`,
    },
    lows: {
      title: es ? 'En su mínimo registrado' : 'At their recorded low',
      note: es ? `Publicados al precio más bajo de al menos ${LOW_MIN_DAYS} días observados antes, en una serie que sí se movió (${LOW_MOVE_PCT} % o más).` : `Published at or below the lowest of at least ${LOW_MIN_DAYS} earlier observed days, in a series that actually moved (${LOW_MOVE_PCT}% or more).`,
      empty: es ? 'Ningún producto tocó su mínimo registrado esta semana. Con poco historial, es lo normal.' : 'Nothing hit its recorded low this week. With little history, that is normal.',
    },
    errors: {
      title: es ? 'Posibles errores de la semana' : 'Possible errors this week',
      note: es ? 'Candidatos de 40 puntos o más en los archivos de la semana, vueltos a puntuar hoy con las reglas de hoy. Lo más probable es que ya no estén a ese precio.' : 'Candidates at 40 points or more in this week\'s archives, re-scored today with today\'s rules. Most likely they are no longer at that price.',
      empty: es ? 'Ningún candidato de la semana aguanta la revisión con las reglas de hoy.' : 'No candidate from this week survives review under today\'s rules.',
      notePrefix: es ? 'Nota del clasificador' : 'Classifier note (in Spanish)',
    },
    forecast: { title: es ? 'Lo que aprendió el modelo' : 'What the model learned', lines },
    rule: es ? `Regla n.º ${w.rule.n}: ${w.rule.es}` : `Rule no. ${w.rule.n}: ${w.rule.en}`,
    signature: 'Don Centavo',
  }
}

/** One line per listed item, for the RSS description and anyone reading the copy as text. */
/** The evidence of one listed item, without its title and store (the page shows those as the link). */
export function dropDetail(x: WeekFile['drops'][number], loc: Loc): string {
  return loc === 'es'
    ? `de ${money(x.before, x.deal.currency, loc)} el ${dayMonth(x.beforeDate, loc)} a ${money(x.after, x.deal.currency, loc)} el ${dayMonth(x.afterDate, loc)}, −${pctText(x.pct, loc)}.`
    : `from ${money(x.before, x.deal.currency, loc)} on ${dayMonth(x.beforeDate, loc)} to ${money(x.after, x.deal.currency, loc)} on ${dayMonth(x.afterDate, loc)}, −${pctText(x.pct, loc)}.`
}
export function lowDetail(x: WeekFile['lows'][number], loc: Loc): string {
  return loc === 'es'
    ? `${money(x.price, x.deal.currency, loc)} el ${dayMonth(x.date, loc)}; antes, entre ${money(x.priorLow, x.deal.currency, loc)} y ${money(x.priorHigh, x.deal.currency, loc)} en ${plural(x.priorDays, 'día observado', 'días observados', loc)}.`
    : `${money(x.price, x.deal.currency, loc)} on ${dayMonth(x.date, loc)}; before, between ${money(x.priorLow, x.deal.currency, loc)} and ${money(x.priorHigh, x.deal.currency, loc)} over ${plural(x.priorDays, 'observed day', 'observed days', loc)}.`
}
export function errorDetail(x: WeekFile['errors'][number], loc: Loc): string {
  return loc === 'es'
    ? `${money(x.price, x.deal.currency, loc)} el ${dayMonth(x.date, loc)}, ${num(x.errorScore, loc)} puntos de error.`
    : `${money(x.price, x.deal.currency, loc)} on ${dayMonth(x.date, loc)}, ${num(x.errorScore, loc)} error points.`
}
/**
 * A listed item's title without a bare trailing price. Techbargains titles end
 * in the price on the day they were published ("Heated Socks $41.29"); next to
 * a drop "from 41.29 to 29.49" that stale number reads as a contradiction.
 * Only a lone "$N" at the very end goes; "for $1,549 in cart" keeps its words,
 * and a title that would end on "for"/"to"/"at"... or be empty is left alone.
 */
export function weekTitle(title: string): string {
  const m = /\s+\$\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*$/.exec(title)
  if (!m) return title
  const rest = title.slice(0, m.index).trimEnd()
  if (!rest || /\b(?:for|to|at|from|under|only|just|now|was|is|and|or|w\/)$/i.test(rest)) return title
  return rest
}
const named = (x: { deal: WeekDeal }) => `${weekTitle(x.deal.title)} (${x.deal.store}): `
export const dropLine = (x: WeekFile['drops'][number], loc: Loc) => named(x) + dropDetail(x, loc)
export const lowLine = (x: WeekFile['lows'][number], loc: Loc) => named(x) + lowDetail(x, loc)
export const errorLine = (x: WeekFile['errors'][number], loc: Loc) => named(x) + errorDetail(x, loc)

/** The digest as plain text in one language: the RSS item's description. */
export function weekText(w: WeekFile, loc: Loc): string {
  const c = weekCopy(w, loc)
  const section = (title: string, lines: string[], empty: string) => [title + '.', ...(lines.length ? lines.map(l => '· ' + l) : [empty])].join('\n')
  return [
    `${c.title}, ${c.range}.`,
    c.lede,
    ...(c.thin ? [c.thin] : []),
    section(c.drops.title, w.drops.map(x => dropLine(x, loc)), c.drops.empty),
    section(c.lows.title, w.lows.map(x => lowLine(x, loc)), c.lows.empty),
    section(c.errors.title, w.errors.map(x => errorLine(x, loc) + (x.note ? (loc === 'es' ? ` ${c.errors.notePrefix}: «${x.note}»` : ` ${c.errors.notePrefix}: "${x.note}"`) : '')), c.errors.empty),
    [c.forecast.title + '.', ...c.forecast.lines].join(' '),
    `${c.rule} (${c.signature})`,
  ].join('\n\n')
}
