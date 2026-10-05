import type { Deal } from './types.ts'
import { formatMoney, formatPercentage } from './format.ts'

export function discount(price: number, list: number | null): number | null {
  return Number.isFinite(price) && price >= 0 && list !== null && Number.isFinite(list) && list > price
    ? Math.round((1 - price / list) * 10000) / 100 : null
}

export function scoreDeal(d: Omit<Deal, 'score' | 'flag' | 'reasons'>, now: Date): Pick<Deal, 'score' | 'flag' | 'reasons'> {
  const pct = discount(d.price, d.listPrice) ?? 0
  const saved = pct ? d.listPrice! - d.price : 0
  const comparable = ['USD', 'EUR', 'GBP'].includes(d.currency)
  const published = Date.parse(d.publishedAt)
  const age = Number.isFinite(published) ? Math.max(0, (now.getTime() - published) / 86400000) : Infinity
  const fresh = Number.isFinite(age) ? Math.exp(-age / 3) : 0
  const signal = Number.isFinite(d.sourceSignal) ? Math.max(0, d.sourceSignal!) : 0
  const score = Math.round(Math.min(100, pct * .6 + (comparable ? Math.min(20, Math.log1p(saved) * 3) : 0) + fresh * 12 + Math.min(8, Math.log1p(signal) * 1.5)))
  const explicit = /\b(?:price (?:error|mistake)|pricing (?:error|mistake)|glitch|error de precio)\b/i.test(d.title)
    && !/\b(?:no|not|isn't|sin)\b.{0,20}\b(?:error|mistake|glitch)\b|\?|\b(?:fixed|expired|ended|corregido|agotado)\b/i.test(d.title)
  // Deep game sales and intentional giveaways are commonplace, not pricing errors.
  const promotion = d.price === 0 || /videojuegos|games|clothing|shirts|shoes|activewear|apparel/i.test(d.category || '') || /\b(?:giveaway|clearance|liquidaci[oó]n|free to keep)\b/i.test(d.title)
  const extreme = comparable && d.listPrice! > 40 && d.price <= d.listPrice! * .15 && pct >= 85 && !promotion
  const flag = d.price < 0 || !Number.isFinite(d.price) ? 'normal' : explicit || extreme ? 'error-probable' : pct >= 50 || (comparable && saved >= 40 && pct >= 30) || d.price === 0 ? 'chollo' : 'normal'
  const reasons: string[] = []
  if (explicit && flag === 'error-probable') reasons.push('La fuente indica un posible error')
  if (pct) reasons.push(`${formatPercentage(pct)} bajo el precio de lista`)
  if (saved && comparable) reasons.push(`Ahorro de ${formatMoney(saved)} ${d.currency}`)
  if (d.price === 0) reasons.push('Oferta gratuita')
  if (signal >= 10) reasons.push('Destacada por la comunidad')
  if (!reasons.length) reasons.push('Precio de referencia no disponible')
  return { score, flag, reasons }
}
