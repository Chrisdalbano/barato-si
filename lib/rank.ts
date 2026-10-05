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
  const explicit = [d.title, d.sourceText || ''].some(text => text.split(/(?<=[.!?])\s+/).some(sentence =>
    /\b(?:price (?:error|mistake)|pricing (?:error|mistake)|glitch|mispriced|error de precio)\b/i.test(sentence)
    && !/\b(?:no|not|isn't|sin|wasn't|never)\b.{0,40}\b(?:error|mistake|glitch|mispriced)\b|\?|\b(?:fixed|expired|ended|corregido|agotado)\b/i.test(sentence)))
  // Deep game sales and intentional giveaways are commonplace, not pricing errors.
  const game = /videojuegos|games/i.test(d.category || '')
  const clothing = /clothing|shirts|shoes|activewear|apparel/i.test(d.category || '') || /\b(?:shirt|shoes|sneakers|jacket|pants|jeans|dress|hoodie|socks)\b/i.test(d.title)
  const promotion = game || clothing || d.price === 0 || /videojuegos|games|clothing|shirts|shoes|activewear|apparel/i.test(d.category || '') || /\b(?:giveaway|clearance|liquidaci[oó]n|free to keep)\b/i.test(d.title)
  const extreme = comparable && d.listPrice! > 40 && d.price <= d.listPrice! * .15 && pct >= 85 && !promotion
  const deep = comparable && d.listPrice! > 40 && pct >= 75 && !promotion
  const flag = d.price < 0 || !Number.isFinite(d.price) ? 'normal' : d.price === 0 ? 'chollo' : (explicit && !game) || extreme ? 'error-probable' : (game ? pct >= 90 && d.listPrice! >= 30 : pct >= 50) || (!game && comparable && saved >= 40 && pct >= 30) || d.price === 0 ? 'chollo' : 'normal'
  const reasons: string[] = []
  if (explicit && flag === 'error-probable') reasons.push('La fuente indica un posible error')
  if (deep && flag === 'chollo') reasons.push('Descuento inusualmente profundo')
  if (pct) reasons.push(`${formatPercentage(pct)} bajo el precio de lista`)
  if (saved && comparable) reasons.push(`Ahorro de ${formatMoney(saved)} ${d.currency}`)
  if (d.price === 0) reasons.push('Gratis por tiempo limitado')
  if (signal >= 10) reasons.push('Destacada por la comunidad')
  if (!reasons.length) reasons.push('Precio de referencia no disponible')
  return { score, flag, reasons }
}
