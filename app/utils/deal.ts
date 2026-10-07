// Small, pure helpers about a single deal. Shared by every card, row and page.

/** Anything with the link fields of a deal. */
interface Linkable { url: string; storeUrl?: string | null }

/**
 * Where "Ver en <tienda>" goes: the merchant's own page when the pipeline knows
 * it and may link it, else the source's required link (CheapShark redirect,
 * DealNews item page). The source stays visible as the separate "vía" link.
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

/** Error thresholds offered on /errores and the home section. */
export const ERROR_LEVELS = [40, 55, 70] as const

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

/** "modelo · 78 %" for an ai confidence in 0-1. */
export function confidenceLabel(confidence: number): string {
  const c = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0
  return `modelo · ${Math.round(c * 100)} %`
}
