import { expect, it } from 'vitest'
import { dedupe } from '../lib/index'
import { canonicalUrl, dealId } from '../lib/dedupe'
import { deal } from './helpers'

it('canonicalizes tracking without changing the outgoing attribution link', () => {
  const a = deal({ url: 'http://www.shop.test/p?utm_source=feed&id=1#x', score: 10 })
  const b = deal({ url: 'https://shop.test/p?id=1', score: 5 })
  expect(dedupe([b, a])).toEqual([a])
  expect(dealId(a.url)).toBe(dealId(b.url))
  expect(canonicalUrl('javascript:alert(1)')).toBe('')
})
it('preserves identity query parameters and different variants', () => {
  expect(dealId('https://shop.test/?dealID=1')).not.toBe(dealId('https://shop.test/?dealID=2'))
  expect(dedupe([deal({ title: 'Samsung EVO 1TB SSD' }), deal({ id: 'b', url: 'https://other.test/1', title: 'Samsung EVO 2TB SSD' })])).toHaveLength(2)
})
it('merges near-identical cross-source titles and does not mutate input', () => {
  const input = [deal({ title: 'Samsung 990 PRO 2TB SSD for $20 + free shipping', source: 'one', score: 1 }), deal({ id: 'b', title: 'Samsung 990 PRO 2TB SSD $20', url: 'https://other.test/x', source: 'two', score: 5 })]
  const copy = structuredClone(input)
  expect(dedupe(input)).toHaveLength(1)
  expect(input).toEqual(copy)
})
it('keeps different prices and currencies without a shared canonical URL', () => {
  const a = deal()
  expect(dedupe([a, deal({ id: 'b', url: 'https://other.test/x', price: 21 }), deal({ id: 'c', url: 'https://other.test/y', currency: 'EUR' })])).toHaveLength(3)
})
