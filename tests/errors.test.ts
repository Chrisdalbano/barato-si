import { expect, it } from 'vitest'
import { scoreDeal } from '../lib/rank'
import { deal, now } from './helpers'

const laptop = deal({ title: 'Lenovo Legion 5 RTX 4060 Laptop for $99 (was $1,199)', store: 'Amazon', category: 'informatica', price: 99, listPrice: 1199 })
it('detects a high-ticket laptop anomaly with checkable independent signals', () => {
  const result = scoreDeal(laptop, now)
  expect(result.flag).toBe('error-probable')
  expect(result.errorScore).toBe(100)
  expect(result.errorSignals.length).toBeGreaterThanOrEqual(3)
  expect(result.errorSignals[0]).toContain('8 %')
})
it.each([
  [{ title: 'Suicide Squad Deluxe', store: 'IndieGala', category: 'videojuegos', price: 4.38, listPrice: 99.99 }, 15, 'chollo'],
  [{ title: 'Alfani shirt', category: 'ropa', price: 7.46, listPrice: 50 }, 40, 'chollo'],
  [{ title: 'VPN price error', category: 'software', price: 1, listPrice: 1000 }, 15, 'chollo'],
  [{ title: 'Free laptop price error', price: 0, listPrice: 1200 }, 0, 'chollo'],
  [{ title: 'Laptop from $99', price: 99, listPrice: 1200 }, 0, 'chollo'],
] as const)('caps ordinary promotions: %j', (values, cap, flag) => {
  const r = scoreDeal(deal(values), now)
  expect(r.errorScore).toBeLessThanOrEqual(cap)
  expect(r.flag).toBe(flag)
})
it('requires affirmative sentence-level evidence', () => {
  for (const sourceText of ['Possible price error.', 'A pricing mistake.']) expect(scoreDeal(deal({ price: 60, listPrice: 100, sourceText }), now).errorScore).toBe(35)
  for (const sourceText of ['Not a price error.', 'Price error? Fixed now.', 'This is not a pricing mistake.']) expect(scoreDeal(deal({ price: 60, listPrice: 100, sourceText }), now).errorScore).toBe(0)
})
it('demotes stable prices and notices a sudden archive drop', () => {
  const d = deal({ price: 10, listPrice: 100 })
  const history = { days: 3, minPrice: 10, maxPrice: 10.1, firstSeen: '2026-10-01' }
  const result = scoreDeal(d, now, history)
  expect(result.errorScore).toBe(40)
  expect(result.errorSignals.join(' ')).toContain('3 días seguidos')
  expect(scoreDeal(d, now, { ...history, minPrice: 50, maxPrice: 60 }).errorScore).toBe(75)
})
it('never calls the $99 laptop an error after three stable archive days', () => {
  const history = { days: 3, minPrice: 99, maxPrice: 99, firstSeen: '2026-10-01' }
  expect(scoreDeal(laptop, now, history)).toMatchObject({ errorScore: 69, flag: 'chollo' })
})
it('includes demotion evidence and obeys model confidence boundaries', () => {
  expect(scoreDeal({ ...laptop, title: 'Refurbished laptop with code' }, now).errorScore).toBe(55)
  const ai = { product: 'Laptop', category: 'informatica' as const, verdict: 'noise' as const, confidence: .7, note: 'Oferta múltiple o condicionada', model: 'fixture' }
  expect(scoreDeal({ ...laptop, ai }, now)).toMatchObject({ errorScore: 0, flag: 'normal', reasons: expect.arrayContaining(['Oferta múltiple o condicionada']) })
  expect(scoreDeal({ ...laptop, ai: { ...ai, confidence: .69 } }, now).errorScore).toBe(100)
  expect(scoreDeal({ ...laptop, ai: { ...ai, verdict: 'normal', confidence: .8 } }, now).errorScore).toBe(80)
  expect(scoreDeal({ ...laptop, ai: { ...ai, verdict: 'deep' } }, now).errorScore).toBe(90)
})
