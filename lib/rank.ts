import type { Deal } from './types.ts'
import { scoreError, type UnscoredDeal } from './errors.ts'
import { categorize } from './categorize.ts'
import { formatMoney, formatPercentage } from './format.ts'

export function discount(price: number, list: number | null): number | null {
  return Number.isFinite(price) && price >= 0 && list !== null && Number.isFinite(list) && list > price
    ? Math.round((1 - price / list) * 10000) / 100 : null
}

export function scoreDeal(d: UnscoredDeal, now: Date, history = d.history): Pick<Deal, 'score' | 'flag' | 'reasons' | 'errorScore' | 'errorSignals'> {
  const pct = discount(d.price, d.listPrice) ?? 0
  const saved = pct ? d.listPrice! - d.price : 0
  const comparable = ['USD', 'EUR', 'GBP'].includes(d.currency)
  const published = Date.parse(d.publishedAt)
  const age = Number.isFinite(published) ? Math.max(0, (now.getTime() - published) / 86400000) : Infinity
  const fresh = Number.isFinite(age) ? Math.exp(-age / 3) : 0
  const signal = Number.isFinite(d.sourceSignal) ? Math.max(0, d.sourceSignal!) : 0
  const score = Math.round(Math.min(100, pct * .6 + (comparable ? Math.min(20, Math.log1p(saved) * 3) : 0) + fresh * 12 + Math.min(8, Math.log1p(signal) * 1.5)))
  const errors = scoreError(d, pct, history)
  const category = categorize(d.title, d.category, d.store)
  const game = category === 'videojuegos'
  const promotion = game || category === 'ropa' || d.price === 0 || /clearance|liquidación/i.test(d.title)
  const deep = comparable && d.listPrice! > 40 && pct >= 75 && !promotion
  const noise = d.ai?.verdict === 'noise' && d.ai.confidence >= .7
  const flag = noise || d.price < 0 || !Number.isFinite(d.price) ? 'normal' : errors.errorScore >= 70 ? 'error-probable' : (game ? pct >= 90 && d.listPrice! >= 30 : pct >= 50) || (!game && comparable && saved >= 40 && pct >= 30) || d.price === 0 ? 'chollo' : 'normal'
  const reasons: string[] = []
  if (noise) reasons.push('Oferta múltiple o condicionada')
  if (deep && flag === 'chollo') reasons.push('Descuento inusualmente profundo')
  if (pct) reasons.push(`${formatPercentage(pct)} bajo el precio de lista`)
  if (saved && comparable) reasons.push(`Ahorro de ${formatMoney(saved)} ${d.currency}`)
  if (d.price === 0) reasons.push('Gratis por tiempo limitado')
  if (signal >= 10) reasons.push('Destacada por la comunidad')
  if (!reasons.length) reasons.push('Precio de referencia no disponible')
  return { score, flag, reasons, ...errors }
}
