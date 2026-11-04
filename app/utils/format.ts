// Formatting helpers. Every formatter pins its locale (and UTC where a date is
// involved) so the prerendered HTML and the hydrated client agree. The last
// argument is the page language; Spanish is the default, so older callers and
// the tests read exactly as before.
import { INTL } from './locale'
import type { Locale } from './locale'

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>()
function nf(loc: Locale, opts: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `n:${loc}:${JSON.stringify(opts)}`
  let f = cache.get(key) as Intl.NumberFormat | undefined
  if (!f) { f = new Intl.NumberFormat(INTL[loc], opts); cache.set(key, f) }
  return f
}
function df(loc: Locale, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d:${loc}:${JSON.stringify(opts)}`
  let f = cache.get(key) as Intl.DateTimeFormat | undefined
  if (!f) { f = new Intl.DateTimeFormat(INTL[loc], { timeZone: 'UTC', ...opts }); cache.set(key, f) }
  return f
}

export function formatNumber(value: number, loc: Locale = 'es'): string {
  return nf(loc).format(value)
}

export function formatMoney(value: number, currency: string, digits = 2, loc: Locale = 'es'): string {
  try {
    return nf(loc, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  } catch {
    return `${value.toFixed(digits)} ${currency}`
  }
}

/** A price as readers see it: 0 is "Gratis" / "Free", never "0,00 US$". */
export function formatPrice(value: number, currency: string, digits = 2, loc: Locale = 'es'): string {
  if (!Number.isFinite(value)) return ''
  if (value <= 0) return loc === 'en' ? 'Free' : 'Gratis'
  return formatMoney(value, currency, digits, loc)
}

/** True when a list price is real and above the sale price, so a strike makes sense. */
export function hasListPrice(price: number, listPrice: number | null | undefined): listPrice is number {
  return typeof listPrice === 'number' && Number.isFinite(listPrice) && listPrice > 0 && listPrice > price
}

/** Whole numbers stay whole ("29 US$"); anything with cents keeps two digits. */
export function moneyDigits(...values: (number | null | undefined)[]): number {
  return values.every(v => v == null || Number.isInteger(v)) ? 0 : 2
}

export function formatDiscount(discountPct: number, loc: Locale = 'es'): string {
  const p = Math.max(0, Math.min(100, discountPct))
  return `−${nf(loc, { style: 'percent', maximumFractionDigits: 0 }).format(p / 100)}`
}

/** 0-1 as a whole percent: "72 %" / "72%". */
export function formatShare(share: number, loc: Locale = 'es'): string {
  const p = Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0
  return nf(loc, { style: 'percent', maximumFractionDigits: 0 }).format(p)
}

export function formatDay(isoDate: string, loc: Locale = 'es'): string {
  return df(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${isoDate}T12:00:00Z`))
}

export function formatShortDay(isoDate: string, loc: Locale = 'es'): string {
  return df(loc, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${isoDate}T12:00:00Z`))
}

/** "3 nov" / "Nov 3", for dates in running text. */
export function formatDayMonth(iso: string, loc: Locale = 'es'): string {
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso)
  if (!Number.isFinite(t)) return ''
  return df(loc, { day: 'numeric', month: 'short' }).format(new Date(t)).replace('.', '')
}

export function formatGenerated(iso: string, loc: Locale = 'es'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return loc === 'en' ? 'time unknown' : 'hora desconocida'
  const clock = df(loc, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${df(loc, { day: 'numeric', month: 'short' }).format(d)}, ${clock} UTC`
}

export function formatAgo(iso: string, now: number, loc: Locale = 'es'): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const key = `r:${loc}`
  let rel = cache.get(key) as Intl.RelativeTimeFormat | undefined
  if (!rel) { rel = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }); cache.set(key, rel) }
  const minutes = Math.round((t - now) / 60000)
  if (Math.abs(minutes) < 1) return loc === 'en' ? 'just now' : 'ahora mismo'
  if (Math.abs(minutes) < 60) return rel.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rel.format(hours, 'hour')
  return rel.format(Math.round(hours / 24), 'day')
}

/** Compact age for the table: "<1 h", "5 h", "3 d". The same in both languages. */
export function formatAgeShort(iso: string, now: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t) || !Number.isFinite(now)) return '—'
  const hours = Math.floor((now - t) / 3600000)
  if (hours < 1) return '<1 h'
  if (hours < 48) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
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

// The data keeps its internal flag values; readers see neutral words.
export const FLAG_LABEL: Record<string, string> = {
  'error-probable': 'Posible error de precio',
  chollo: 'Baratísimo',
}
export const FLAG_LABEL_EN: Record<string, string> = {
  'error-probable': 'Possible price error',
  chollo: 'Dirt cheap',
}
export function flagLabel(flag: string, loc: Locale = 'es'): string {
  return (loc === 'en' ? FLAG_LABEL_EN : FLAG_LABEL)[flag] ?? flag
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
export function sourcesLine(sources: readonly SourceView[] | null | undefined, loc: Locale = 'es'): { working: string; quiet: string } {
  const list = Array.isArray(sources) ? sources.filter(s => s && typeof s.name === 'string') : []
  const working = list.filter(s => s.ok && s.count > 0)
  const silent = list.filter(s => !s.ok)
  const w = working.map(s => `${sourceName(s.name)} ${formatNumber(s.count, loc)}`).join(' · ')
  const en = loc === 'en'
  let quiet = ''
  if (silent.length === 1) quiet = en ? `${sourceName(silent[0]!.name)} did not answer today.` : `${sourceName(silent[0]!.name)}, sin respuesta hoy.`
  else if (silent.length > 1 && silent.length <= 3) {
    const names = silent.map(s => sourceName(s.name))
    quiet = en
      ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)} did not answer today.`
      : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}, sin respuesta hoy.`
  } else if (silent.length > 3) quiet = en ? `${silent.length} sources did not answer today.` : `${silent.length} fuentes sin respuesta hoy.`
  return { working: w, quiet }
}

/** "1 oferta", "36 ofertas". */
export function plural(n: number, one: string, many: string, loc: Locale = 'es'): string {
  return `${formatNumber(n, loc)} ${n === 1 ? one : many}`
}
