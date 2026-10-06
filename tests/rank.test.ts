import { describe, expect, it } from 'vitest'
import { scoreDeal } from '../lib/index'
import { deal, now } from './helpers'

describe('conservative ranking', () => {
  it('formats savings and fractional percentages in Spanish', () => {
    expect(scoreDeal(deal({ price: 7.46, listPrice: 50 }), now).reasons).toEqual([
      'Descuento inusualmente profundo', '85,08\u00a0% bajo el precio de lista', 'Ahorro de 42,54 USD',
    ])
  })
  it('keeps reasons valid in archives while freshness still affects the score', () => {
    const offer = deal({ price: 7.46, listPrice: 50 })
    const current = scoreDeal(offer, now)
    const archived = scoreDeal(offer, new Date(now.getTime() + 30 * 86400000))
    expect(current.reasons).toEqual(archived.reasons)
    expect(current.score).toBeGreaterThan(archived.score)
    expect(scoreDeal(deal({ listPrice: null }), now).reasons).toEqual(['Precio de referencia no disponible'])
  })
  it.each([
    [{ price: 10, listPrice: 100 }, 'chollo'],
    [{ price: 15, listPrice: 100 }, 'chollo'],
    [{ price: 16, listPrice: 100 }, 'chollo'],
    [{ price: 15.004, listPrice: 100 }, 'chollo'],
    [{ price: 2, listPrice: 40 }, 'chollo'],
    [{ price: 0, listPrice: 100 }, 'chollo'],
    [{ price: 5, listPrice: 100, category: 'videojuegos' }, 'chollo'],
    [{ title: 'Clearance headphones', price: 5, listPrice: 100 }, 'chollo'],
    [{ title: 'Price mistake: headphones', price: 20, listPrice: null }, 'normal'],
    [{ title: 'Not a price error', price: 20, listPrice: null }, 'normal'],
    [{ title: 'Price error?', price: 20, listPrice: null }, 'normal'],
    [{ title: 'Fixed price glitch', price: 20, listPrice: null }, 'normal'],
    [{ price: 100, listPrice: null, discountPct: 99 }, 'normal'],
    [{ price: 2, listPrice: 100, currency: 'JPY' }, 'chollo'],
  ])('classifies %j', (overrides, expected) => expect(scoreDeal(deal(overrides), now).flag).toBe(expected))
  it('recomputes discounts instead of trusting the input percentage', () => {
    expect(scoreDeal(deal({ price: 100, listPrice: 100, discountPct: 99 }), now).flag).toBe('normal')
  })
  it('rewards savings, freshness and actual source signal', () => {
    const score = (o: Parameters<typeof deal>[0]) => scoreDeal(deal(o), now).score
    expect(score({ price: 10 })).toBeGreaterThan(score({ price: 50 }))
    expect(score({ price: 200, listPrice: 1000 })).toBeGreaterThan(score({ price: 2, listPrice: 10 }))
    expect(score({})).toBeGreaterThan(score({ publishedAt: '2026-09-01T00:00:00Z' }))
    expect(score({ sourceSignal: 100 })).toBeGreaterThan(score({ sourceSignal: 0 }))
    expect(score({ publishedAt: '2099-01-01T00:00:00Z' })).toBe(score({}))
  })
  it.each([NaN, Infinity, -1, 0, 1e20])('keeps scores finite for malformed values %s', value => {
    const result = scoreDeal(deal({ price: value, listPrice: value, sourceSignal: value, publishedAt: 'bad' }), now)
    expect(Number.isFinite(result.score)).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

it.each(['price error', 'price mistake', 'pricing error', 'glitch', 'mispriced', 'error de precio'])('recognizes source description evidence: %s', phrase => {
  expect(scoreDeal(deal({ price: 30, listPrice: 50, sourceText: `The retailer has a ${phrase}.` }), now).errorScore).toBe(35)
  expect(scoreDeal(deal({ price: 30, listPrice: 50, sourceText: `Not a ${phrase}?` }), now).flag).toBe('normal')
})
it('keeps deep non-game discounts separate from probable errors', () => {
  const result = scoreDeal(deal({ price: 25, listPrice: 100 }), now)
  expect(result.flag).toBe('chollo')
  expect(result.reasons).toContain('Descuento inusualmente profundo')
  for (const category of ['videojuegos', 'ropa']) {
    expect(scoreDeal(deal({ price: 25, listPrice: 100, category }), now).reasons).not.toContain('Descuento inusualmente profundo')
  }
  expect(scoreDeal(deal({ price: 10, listPrice: 40 }), now).reasons).not.toContain('Descuento inusualmente profundo')
})
it('never calls a giveaway or a game named Glitch a pricing error', () => {
  const free = scoreDeal(deal({ title: 'Price error', price: 0, listPrice: 100 }), now)
  expect(free.flag).toBe('chollo')
  expect(free.reasons).toContain('Gratis por tiempo limitado')
  expect(scoreDeal(deal({ title: 'Glitch', category: 'videojuegos', price: 1, listPrice: 100 }), now).flag).toBe('chollo')
})
