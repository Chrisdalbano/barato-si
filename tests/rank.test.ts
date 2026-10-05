import { describe, expect, it } from 'vitest'
import { scoreDeal } from '../lib/index'
import { deal, now } from './helpers'

describe('conservative ranking', () => {
  it.each([
    [{ price: 10, listPrice: 100 }, 'error-probable'],
    [{ price: 15, listPrice: 100 }, 'error-probable'],
    [{ price: 16, listPrice: 100 }, 'chollo'],
    [{ price: 15.004, listPrice: 100 }, 'chollo'],
    [{ price: 2, listPrice: 40 }, 'chollo'],
    [{ price: 0, listPrice: 100 }, 'chollo'],
    [{ price: 5, listPrice: 100, category: 'videojuegos' }, 'chollo'],
    [{ title: 'Clearance headphones', price: 5, listPrice: 100 }, 'chollo'],
    [{ title: 'Price mistake: headphones', price: 20, listPrice: null }, 'error-probable'],
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
