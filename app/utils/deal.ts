// Small, pure helpers about a single deal. Shared by every card, row and page.
import type { Deal, GateReport, ReferenceKind } from '../../lib/types'
import { formatMoney, formatPrice, hasListPrice, hostOf, moneyDigits, plural, sourceName } from './format'

/** Anything with the link fields of a deal. */
interface Linkable { url: string; storeUrl?: string | null }

/**
 * Where "Ver en <tienda>" goes: the merchant's own page when the pipeline knows
 * it and may link it, else the source's required link (CheapShark redirect,
 * DealNews item page). The source stays visible as the separate "vía" credit.
 */
export function linkFor(deal: Linkable): string {
  return deal.storeUrl ?? deal.url
}

/**
 * The store's domain for the image fallback plate. storeDomain when the pipeline
 * sent it, else the host of the store link, else the store name itself (never
 * the aggregator's host: a CheapShark redirect is not the store).
 */
export function storeMark(deal: { store: string; storeUrl?: string | null; storeDomain?: string | null }): string {
  if (deal.storeDomain) return deal.storeDomain.replace(/^www\./, '')
  if (deal.storeUrl) {
    const host = hostOf(deal.storeUrl)
    if (host) return host
  }
  return deal.store.trim().toLocaleLowerCase('es')
}

/** "ASUS · Amazon"; just "GMKtec" when the brand sells its own product. */
export function whoLine(deal: { brand?: string | null; store: string }): string {
  return deal.brand && deal.brand.toLocaleLowerCase('en') !== deal.store.toLocaleLowerCase('en') ? `${deal.brand} · ${deal.store}` : deal.store
}

/** The "vía" credit reads oddly only when the source is the store itself ("Steam" vía "Steam"). */
export function needsCredit(deal: { store: string; source: string }): boolean {
  const store = deal.store.toLocaleLowerCase('en')
  const source = deal.source.toLocaleLowerCase('en')
  return store !== source && !store.startsWith(`${source} `)
}

// Our coarse categories, in Spanish. Unknown strings (older files carry the
// source's own label) pass through as they are.
export const CATEGORY_LABEL: Record<string, string> = {
  videojuegos: 'Videojuegos',
  informatica: 'Informática',
  electronica: 'Electrónica',
  hogar: 'Hogar',
  cocina: 'Cocina',
  herramientas: 'Herramientas',
  ropa: 'Ropa',
  deporte: 'Deporte',
  juguetes: 'Juguetes',
  belleza: 'Belleza',
  alimentacion: 'Alimentación',
  software: 'Software',
  servicios: 'Servicios',
  otros: 'Otros',
}
export function categoryLabel(value: string): string {
  return CATEGORY_LABEL[value] ?? value
}

/** Error thresholds offered on /errores and in the filters. */
export const ERROR_LEVELS = [40, 55, 70] as const

// ---- Evidence: how much the reference price is worth ------------------------

export type EvidenceStrength = 'fuerte' | 'media' | 'debil' | 'ninguna'
export type EvidenceKey = ReferenceKind | 'ninguna'

/** `short` is for the table, `label` for filters, `against` qualifies the depth figure. */
export const EVIDENCE: Record<EvidenceKey, { label: string; short: string; strength: EvidenceStrength; against: string }> = {
  ledger: { label: 'Historial observado', short: 'historial observado', strength: 'fuerte', against: 'contra lo observado' },
  'cross-store': { label: 'Comparado con otra tienda', short: 'otra tienda', strength: 'fuerte', against: 'contra otra tienda' },
  curated: { label: 'Referencia curada', short: 'referencia curada', strength: 'media', against: 'contra referencia curada' },
  // Someone else's report of a previous price: below our own ledger, above a seller's claim.
  'source-previous': { label: 'Precio anterior reportado', short: 'anterior reportado', strength: 'media', against: 'contra lo reportado' },
  list: { label: 'Lista del vendedor, sin verificar', short: 'lista, sin verificar', strength: 'debil', against: 'según el vendedor' },
  ninguna: { label: 'Sin referencia', short: 'sin referencia', strength: 'ninguna', against: '' },
}
/** Strongest first. */
export const EVIDENCE_ORDER: EvidenceKey[] = ['ledger', 'cross-store', 'curated', 'source-previous', 'list', 'ninguna']
const STRENGTH_RANK: Record<EvidenceStrength, number> = { fuerte: 3, media: 2, debil: 1, ninguna: 0 }

type WithReference = { reference?: Deal['reference'] }
type WithDepth = WithReference & { referenceDiscountPct?: number | null; discountPct?: number | null }

export function evidenceOf(deal: WithReference): EvidenceKey {
  return deal.reference?.kind ?? 'ninguna'
}
export function strengthOf(deal: WithReference): EvidenceStrength {
  return EVIDENCE[evidenceOf(deal)]?.strength ?? 'debil'
}

/** Depth against the reference, falling back to the declared discount. */
export function depthOf(deal: WithDepth): number | null {
  return deal.referenceDiscountPct ?? deal.discountPct ?? null
}

/** Price-error order: strongest evidence first, then errorScore. Never mutates. */
export function byEvidence<T extends WithReference & { errorScore: number }>(deals: readonly T[]): T[] {
  return [...deals].sort((a, b) => STRENGTH_RANK[strengthOf(b)] - STRENGTH_RANK[strengthOf(a)] || b.errorScore - a.errorScore)
}

const LIST_NOTE = 'Precio de lista del vendedor, sin verificar'

/** Always reads as a report, naming who reported it: "Precio anterior según CamelCamelCamel". */
function reportedNote(note: unknown, source: string | undefined): string {
  const named = typeof note === 'string' ? /(?:comunicado por|reportado por|según)\s+(.+?)\.?$/i.exec(note.trim())?.[1] : undefined
  const who = named ?? (source ? sourceName(source) : 'la fuente')
  return `Precio anterior según ${who}`
}

function fallbackNote(kind: ReferenceKind, observations?: number): string {
  if (kind === 'ledger') return observations ? `Mediana de ${plural(observations, 'día observado', 'días observados')}` : 'Mediana de los días observados'
  if (kind === 'cross-store') return observations ? `Comparado con ${plural(observations, 'tienda', 'tiendas')}` : 'Comparado con otra tienda'
  if (kind === 'curated') return 'Precio de referencia curado'
  return LIST_NOTE
}

/**
 * The single place a deal gets its reference, for every file version. A v1/v2
 * row with a list price gets a `list` reference, which is exactly what a list
 * price is: the seller's claim. A malformed reference counts as none.
 */
export function normalizeReference(d: Pick<Deal, 'price' | 'listPrice' | 'discountPct' | 'reference' | 'referenceDiscountPct'> & { source?: string }): { reference?: NonNullable<Deal['reference']>; referenceDiscountPct: number | null } {
  const raw = d.reference
  let reference: NonNullable<Deal['reference']> | undefined
  if (raw && typeof raw.price === 'number' && Number.isFinite(raw.price) && raw.price > 0) {
    // An unknown kind from a future pipeline counts as the weakest, never the strongest.
    const known = (raw.kind as string) !== 'ninguna' && raw.kind in EVIDENCE
    const kind: ReferenceKind = known ? raw.kind : 'list'
    const observations = typeof raw.observations === 'number' && raw.observations > 0 ? raw.observations : undefined
    reference = {
      price: raw.price, kind,
      ...(observations ? { observations } : {}),
      ...(typeof raw.asOf === 'string' && raw.asOf ? { asOf: raw.asOf } : {}),
      // The weakest kind always reads the same plain words.
      note: kind === 'list' ? LIST_NOTE : kind === 'source-previous' ? reportedNote(raw.note, d.source) : (typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : fallbackNote(kind, observations)),
    }
  } else if (!raw && hasListPrice(d.price, d.listPrice)) {
    reference = { price: d.listPrice, kind: 'list', note: LIST_NOTE }
  }
  if (!reference) return { referenceDiscountPct: null }
  const given = d.referenceDiscountPct
  const pct = typeof given === 'number' && Number.isFinite(given)
    ? given
    : (!raw && typeof d.discountPct === 'number' ? d.discountPct : Math.round((1 - d.price / reference.price) * 100))
  return { reference, referenceDiscountPct: Math.max(0, Math.min(100, pct)) }
}

const asOfDay = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** The evidence as one readable line, dated when the evidence is dated. */
export function evidenceLine(reference: Deal['reference']): string {
  if (!reference) return 'Sin referencia de precio'
  const t = reference.asOf ? Date.parse(reference.asOf) : NaN
  return Number.isFinite(t) && reference.kind === 'curated'
    ? `${reference.note} (${asOfDay.format(new Date(t)).replace('.', '')})`
    : reference.note
}

// ---- Gate: what the interest filter kept out --------------------------------

const GATE_LABEL: Record<string, string> = {
  apparel: 'ropa',
  food: 'alimentación',
  beauty: 'belleza',
  'seasonal-decor': 'decoración de temporada',
  'gift-card': 'tarjetas regalo',
  'low-value': 'poco valor',
  'noname-inflated': 'precio de lista inflado',
  'middleman-duplicate': 'duplicado de intermediario',
  'catalog-price': 'precio de catálogo, sin rebaja real',
  'publication-cap': 'fuera del tope de publicación',
  'replacement-part': 'repuestos',
  'variant-duplicate': 'variantes de la misma oferta',
}
export function gateReasonLabel(slug: string): string {
  return GATE_LABEL[slug] ?? slug
}

/**
 * The publication cap is not a verdict on the offer: it passed the filter and the
 * list was full. The pipeline adds it to `rejected`, so it is taken back out here,
 * and the reasons below list only real rejections.
 */
export function gateSummary(gate: GateReport): { quality: number; capped: number; reasons: { slug: string; label: string; n: number }[] } {
  const capped = gate.byReason['publication-cap'] ?? 0
  const reasons = Object.entries(gate.byReason)
    .filter(([slug]) => slug !== 'publication-cap')
    .map(([slug, n]) => ({ slug, label: gateReasonLabel(slug), n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'))
  return { quality: Math.max(0, gate.rejected - capped), capped, reasons }
}

/** Malformed input gives null, never a broken block. */
export function normalizeGate(gate: unknown): GateReport | null {
  const g = gate as GateReport | null | undefined
  if (!g || typeof g !== 'object') return null
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
  if (!isNum(g.considered) || !isNum(g.published) || !isNum(g.rejected)) return null
  const byReason: Record<string, number> = {}
  for (const [k, v] of Object.entries(g.byReason ?? {})) if (isNum(v) && v > 0) byReason[k] = v
  return { considered: g.considered, published: g.published, rejected: g.rejected, byReason }
}

// ---- History ----------------------------------------------------------------

const seenDay = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "visto desde el 3 oct, mínimo 99 US$"; empty when there is nothing usable. */
export function historyLine(
  history: { days: number; minPrice: number; maxPrice: number; firstSeen: string } | undefined,
  currency: string,
): string {
  if (!history) return ''
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(history.firstSeen) ? `${history.firstSeen}T12:00:00Z` : history.firstSeen)
  const parts: string[] = []
  if (Number.isFinite(t)) parts.push(`visto desde el ${seenDay.format(new Date(t)).replace('.', '')}`)
  else if (history.days > 0) parts.push(`visto ${plural(history.days, 'día', 'días')} antes`)
  if (Number.isFinite(history.minPrice)) {
    const digits = moneyDigits(history.minPrice)
    parts.push(`mínimo ${formatPrice(history.minPrice, currency, digits)}`)
  }
  return parts.join(', ')
}

/**
 * Where today's price sits in what the archive saw. `history` carries only a
 * minimum and a maximum, so this is a range with a tick, not a line: three real
 * numbers and no points in between. Null when there is no range to draw.
 */
export function historyRange(
  history: { days: number; minPrice: number; maxPrice: number } | undefined,
  price: number,
  currency: string,
): { position: number; label: string } | null {
  if (!history || !(history.days > 0) || !Number.isFinite(history.minPrice) || !Number.isFinite(history.maxPrice)) return null
  const low = Math.min(history.minPrice, price)
  const high = Math.max(history.maxPrice, price)
  if (!(high > low)) return null
  const d = moneyDigits(low, high)
  return {
    position: (price - low) / (high - low),
    label: `Hoy ${formatPrice(price, currency, d)}. En ${plural(history.days, 'día anterior', 'días anteriores')}, entre ${formatMoney(history.minPrice, currency, d)} y ${formatMoney(history.maxPrice, currency, d)}.`,
  }
}

/** "modelo · 78 %" for an ai confidence in 0-1. */
export function confidenceLabel(confidence: number): string {
  const c = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0
  return `modelo · ${Math.round(c * 100)} %`
}
