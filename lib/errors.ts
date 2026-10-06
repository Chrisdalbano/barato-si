import type { Deal } from './types.ts'
import { categorize } from './categorize.ts'
import { formatMoney } from './format.ts'

export type UnscoredDeal = Omit<Deal, 'score' | 'flag' | 'reasons' | 'errorScore' | 'errorSignals'>
export function explicitError(d: Pick<Deal, 'title' | 'sourceText'>): boolean {
  return [d.title, d.sourceText || ''].some(text => text.split(/(?<=[.!?])\s+/).some(sentence =>
    /\b(?:price (?:error|mistake)|pricing (?:error|mistake)|glitch|mispriced|error de precio)\b/i.test(sentence)
    && !/\b(?:no|not|isn't|sin|wasn't|never)\b.{0,40}\b(?:error|mistake|glitch|mispriced)\b|\?|\b(?:fixed|expired|ended|corregido|agotado)\b/i.test(sentence)))
}
export const roundup = (title: string) => /\b(?:up to|from|starting at)\s*(?:[$€£]|\d)|\b(?:sitewide|storewide|buy one get|deals on|latest discounts)\b|^\s*sale:/i.test(title)

export function scoreError(d: UnscoredDeal, pct: number, history = d.history): Pick<Deal, 'errorScore' | 'errorSignals'> {
  let total = 0
  const evidence: { weight: number; text: string }[] = []
  const add = (weight: number, text: string) => { total += weight; evidence.push({ weight: Math.abs(weight), text }) }
  const list = d.listPrice || 0
  const stable = !!history && history.days >= 2 && Math.abs(history.minPrice - d.price) <= d.price * .02 && Math.abs(history.maxPrice - d.price) <= d.price * .02
  const comparable = ['USD', 'EUR', 'GBP'].includes(d.currency)
  const category = categorize(d.title, d.category, d.store)
  if (comparable && list > 40 && pct >= 85) add(pct >= 95 ? 75 : pct >= 90 ? 65 : 55, `Cuesta el ${Math.round(d.price / list * 100)} % del precio de lista`)
  if (comparable && list >= 300) add(list >= 1000 ? 20 : 10, `Artículo de precio alto (lista ${formatMoney(list)} ${d.currency})`)
  if (comparable && list >= 200 && pct >= 70 && (['informatica', 'electronica'].includes(category) || /\b(laptop|notebook|RTX|GPU|graphics card|OLED|TV|iPhone|MacBook|iPad|Galaxy|PlayStation|Xbox|Switch 2|camera|lens)\b/i.test(d.title))) add(15, 'Electrónica cara con rebaja fuera de lo normal')
  if (explicitError(d)) add(35, 'La fuente habla de un posible error de precio')
  if (/\b(clearance|liquidación|open box|open-box|refurb\w*|renewed|used|pre-owned|certified)\b/i.test(d.title)) add(-30, 'Reacondicionado o liquidación: rebaja esperable')
  if (/w\/ coupon|with code|clip coupon|promo code|subscribe|S&S/i.test(d.title)) add(-15, 'Rebaja condicionada a cupón o suscripción')
  if (history) {
    if (stable) add(-25, `Mismo precio ${history.days} días seguidos: rebaja estable, no error`)
    if (d.price < history.minPrice * .4) add(10, 'Baja repentina frente al archivo')
  }
  if (d.ai && d.ai.confidence >= .7) {
    if (d.ai.verdict === 'error') add(20, d.ai.note)
    if (d.ai.verdict === 'deep') add(-10, d.ai.note)
    if (d.ai.verdict === 'normal' && d.ai.confidence >= .8) add(-20, d.ai.note)
  }
  // Caps apply last: a model cannot turn an ordinary game sale into an error.
  // The required stable-laptop example needs a ceiling as well as the -25 penalty.
  if (stable) total = Math.min(total, 69)
  if (['videojuegos', 'software'].includes(category)) { total = Math.min(total, 15); evidence.push({ weight: 15, text: 'Rebaja habitual en videojuegos o software' }) }
  if (['ropa', 'belleza', 'alimentacion'].includes(category)) { total = Math.min(total, 40); evidence.push({ weight: 40, text: 'Categoría con liquidaciones frecuentes' }) }
  if (d.price === 0) { total = 0; evidence.push({ weight: 100, text: 'Gratis: promoción, no error de precio' }) }
  if (roundup(d.title) || (d.ai?.verdict === 'noise' && d.ai.confidence >= .7)) { total = 0; evidence.push({ weight: 100, text: 'Oferta múltiple o condicionada' }) }
  return { errorScore: Math.round(Math.max(0, Math.min(100, total))), errorSignals: evidence.sort((a, b) => b.weight - a.weight).map(e => e.text) }
}
