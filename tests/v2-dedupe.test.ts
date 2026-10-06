import { it, expect } from 'vitest'
import { dedupe } from '../lib/dedupe'
import { deal } from './helpers'
const steam = deal({ id: 'steam', source: 'Steam', url: 'https://store.steampowered.com/app/100/Game/', storeUrl: 'https://store.steampowered.com/app/100/Game/', price: 10, image: null, score: 50 })
const cheap = deal({ id: 'cheap', source: 'CheapShark', url: 'https://www.cheapshark.com/redirect?dealID=123', storeUrl: 'https://store.steampowered.com/app/100/', price: 10.1, image: 'https://cdn.test/image.jpg', score: 90 })
it('prefers direct Steam at nearly equal prices and inherits a missing image', () => {
  const result = dedupe([{ ...steam }, { ...cheap }])
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ id: 'steam', image: cheap.image })
  expect(steam.image).toBeNull()
})
it('prefers a materially cheaper Steam offer across sources', () => {
  expect(dedupe([{ ...steam }, { ...cheap, price: 5 }])[0]?.id).toBe('cheap')
})
it('matches the same GOG slug but never crosses currencies', () => {
  const a = { ...steam, source: 'GOG', url: 'https://www.gog.com/en/game/title', storeUrl: 'https://www.gog.com/en/game/title' }
  const b = { ...cheap, storeUrl: 'https://www.gog.com/game/title' }
  expect(dedupe([a, b])).toHaveLength(1)
  expect(dedupe([a, { ...b, currency: 'EUR' }])).toHaveLength(2)
})
it('resolves a CheapShark GOG offer against an unambiguous real catalog slug', () => {
  const a = { ...steam, source: 'GOG', store: 'GOG', title: 'Example Game', url: 'https://www.gog.com/en/game/example_game', storeUrl: 'https://www.gog.com/en/game/example_game' }
  const b = { ...cheap, store: 'GOG', title: 'Example Game', storeUrl: null }
  const result = dedupe([a, b])
  expect(result).toHaveLength(1)
  expect(result[0]?.source).toBe('GOG')
})
it('uses model product identity only with currency and relative price agreement', () => {
  const ai = { product: 'Laptop model 3', category: 'informatica' as const, verdict: 'deep' as const, confidence: .9, note: 'Rebaja real', model: 'fixture' }
  const a = deal({ id: 'a', title: 'Title one', ai, price: 100 })
  const b = deal({ id: 'b', url: 'https://other.test/product', storeUrl: 'https://other.test/product', title: 'Completely different', ai, price: 101, image: 'https://cdn.test/image.jpg' })
  const result = dedupe([a, b])
  expect(result).toHaveLength(1)
  expect(result[0]?.storeUrl).toBe(b.storeUrl)
  expect(dedupe([{ ...a }, { ...b, price: 120 }])).toHaveLength(2)
})
