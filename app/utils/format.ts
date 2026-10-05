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

/** Whole numbers stay whole ("29 US$"); anything with cents keeps two digits. */
export function moneyDigits(...values: (number | null | undefined)[]): number {
  return values.every(v => v == null || Number.isInteger(v)) ? 0 : 2
}

const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 })
export function formatDiscount(discountPct: number): string {
  return `−${pct.format(discountPct / 100)}`
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
}
export function sourceName(name: string): string {
  return SOURCE_NAMES[name] ?? name
}

export const FLAG_LABEL: Record<string, string> = {
  'error-probable': 'Error probable',
  chollo: 'Chollo',
}
