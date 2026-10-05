// Spanish formatting helpers. Every formatter pins its locale (and UTC where a
// date is involved) so the prerendered HTML and the hydrated client agree.

const money = new Map<string, Intl.NumberFormat>()

export function formatMoney(value: number, currency: string, digits = 2): string {
  const key = `${currency}:${digits}`
  let fmt = money.get(key)
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat('es-ES', {
        style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
      })
    } catch {
      return `${value.toFixed(digits)} ${currency}`
    }
    money.set(key, fmt)
  }
  return fmt.format(value)
}

/** A price as readers see it: 0 is "Gratis", never "0,00 US$". */
export function formatPrice(value: number, currency: string, digits = 2): string {
  if (!Number.isFinite(value)) return ''
  if (value <= 0) return 'Gratis'
  return formatMoney(value, currency, digits)
}

/** True when a list price is real and above the sale price, so a strike makes sense. */
export function hasListPrice(price: number, listPrice: number | null | undefined): listPrice is number {
  return typeof listPrice === 'number' && Number.isFinite(listPrice) && listPrice > 0 && listPrice > price
}

/** Whole numbers stay whole ("29 US$"); anything with cents keeps two digits. */
export function moneyDigits(...values: (number | null | undefined)[]): number {
  return values.every(v => v == null || Number.isInteger(v)) ? 0 : 2
}

const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 })
export function formatDiscount(discountPct: number): string {
  const p = Math.max(0, Math.min(100, discountPct))
  return `−${pct.format(p / 100)}`
}

const day = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})
export function formatDay(isoDate: string): string {
  return day.format(new Date(`${isoDate}T12:00:00Z`))
}

const shortDay = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
})
export function formatShortDay(isoDate: string): string {
  return shortDay.format(new Date(`${isoDate}T12:00:00Z`))
}

const clock = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })
const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export function formatGenerated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'hora desconocida'
  return `${dayMonth.format(d)}, ${clock.format(d)} UTC`
}

const rel = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
export function formatAgo(iso: string, now: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const minutes = Math.round((t - now) / 60000)
  if (Math.abs(minutes) < 1) return 'ahora mismo'
  if (Math.abs(minutes) < 60) return rel.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rel.format(hours, 'hour')
  return rel.format(Math.round(hours / 24), 'day')
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

const SOURCE_NAMES: Record<string, string> = {
  dealnews: 'DealNews',
  cheapshark: 'CheapShark',
  'slickdeals-frontpage': 'Slickdeals (portada)',
  'slickdeals-popular': 'Slickdeals (populares)',
  'reddit-deals': 'Reddit r/deals',
  'reddit-buildapcsales': 'Reddit r/buildapcsales',
  'reddit-GameDeals': 'Reddit r/GameDeals',
  woot: 'Woot',
  ebay: 'eBay',
  epic: 'Epic Games Store',
  steam: 'Steam',
  gog: 'GOG',
  humble: 'Humble',
}
export function sourceName(name: string): string {
  return SOURCE_NAMES[name] ?? name
}

// The data keeps its internal flag values; readers see neutral Spanish.
export const FLAG_LABEL: Record<string, string> = {
  'error-probable': 'Posible error de precio',
  chollo: 'Baratísimo',
}

/** Flag value in the data <-> readable value in ?tipo=. Old links keep working. */
export const FLAG_QUERY: Record<string, string> = {
  'error-probable': 'posible-error',
  chollo: 'baratisimo',
}
export function flagFromQuery(value: string): string {
  if (!value) return ''
  const hit = Object.entries(FLAG_QUERY).find(([, q]) => q === value)
  if (hit) return hit[0]
  return value in FLAG_QUERY ? value : ''
}

export interface SourceView { name: string; ok: boolean; count: number }

/**
 * The quiet sources line. Working sources with their counts; a source that
 * failed today gets a short mention, never its error text.
 */
export function sourcesLine(sources: readonly SourceView[] | null | undefined): { working: string; quiet: string } {
  const list = Array.isArray(sources) ? sources.filter(s => s && typeof s.name === 'string') : []
  const working = list.filter(s => s.ok && s.count > 0)
  const silent = list.filter(s => !s.ok)
  const nf = new Intl.NumberFormat('es-ES')
  const w = working.map(s => `${sourceName(s.name)} ${nf.format(s.count)}`).join(' · ')
  let quiet = ''
  if (silent.length === 1) quiet = `${sourceName(silent[0]!.name)}, sin respuesta hoy.`
  else if (silent.length > 1 && silent.length <= 3) {
    const names = silent.map(s => sourceName(s.name))
    quiet = `${names.slice(0, -1).join(', ')} y ${names.at(-1)}, sin respuesta hoy.`
  } else if (silent.length > 3) quiet = `${silent.length} fuentes sin respuesta hoy.`
  return { working: w, quiet }
}

/** "1 oferta", "36 ofertas". */
export function plural(n: number, one: string, many: string): string {
  return `${new Intl.NumberFormat('es-ES').format(n)} ${n === 1 ? one : many}`
}
