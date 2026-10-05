import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeSource, type Source } from '../lib/normalize'
import { sources } from '../scripts/sources'
import { feedItems } from '../lib/feeds'
import { now } from './helpers'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const source = (name: string) => sources.find(s => s.name === name)!

describe('real response fixtures (captured 2026-10-05)', () => {
  it('normalizes DealNews and preserves exact attribution, links, and original XML', () => {
    const raw = fixture('dealnews.xml')
    const deals = normalizeSource(source('dealnews'), raw, now)
    expect(deals.length).toBeGreaterThan(0)
    for (const d of deals) {
      expect(d.url).toContain('iref=')
      expect(d.syndication?.attribution).toBe('DealNews')
      expect(feedItems(raw)).toContain(d.syndication?.itemXml)
      expect(d.price).toBeGreaterThanOrEqual(0)
      expect(d.id).toMatch(/^[\da-f]{16}$/)
      expect(Number.isFinite(Date.parse(d.publishedAt))).toBe(true)
    }
    const later = normalizeSource(source('dealnews'), raw, new Date('2026-10-06T00:00:00Z'), deals)
    expect(later[0]?.foundAt).toBe(deals[0]?.foundAt)
  })
  it('rejects roundup prices and shipping thresholds from real DealNews items', () => {
    const deals = normalizeSource(source('dealnews'), fixture('dealnews-roundups.xml'), now)
    expect(deals).toHaveLength(2)
    expect(deals.every(d => d.title.startsWith('Alfani'))).toBe(true)
    expect(deals.every(d => d.flag !== 'error-probable')).toBe(true)
    expect(deals.find(d => d.price === 7.46)?.listPrice).toBe(50)
  })
  it('normalizes Steam cents and ignores expired specials', () => {
    const deals = normalizeSource(source('steam'), fixture('steam.json'), now)
    expect(deals[0]).toMatchObject({ title: 'Cyberpunk 2077', price: 17.99, listPrice: 59.99, category: 'videojuegos', flag: 'chollo' })
    expect(deals[0]?.discountPct).toBeCloseTo(70.01, 2)
    expect(normalizeSource(source('steam'), fixture('steam.json'), new Date('2030-01-01'))).toEqual([])
  })
  it('includes only active Epic giveaways, never upcoming or paid games', () => {
    const deals = normalizeSource(source('epic'), fixture('epic.json'), now)
    expect(deals).toHaveLength(1)
    expect(deals[0]).toMatchObject({ title: 'System Shock 2: 25th Anniversary Remaster', price: 0, flag: 'chollo' })
    expect(deals[0]?.publishedAt).toBe('2026-10-01T15:00:00.000Z')
    expect(normalizeSource(source('epic'), fixture('epic.json'), new Date('2030-01-01'))).toEqual([])
  })
})

describe('synthetic adapter edge cases for blocked/authenticated sources', () => {
  it('CheapShark uses redirect URLs, USD and actual deal ratings', () => {
    const raw = JSON.stringify([{ title: 'Space Quest', dealID: 'a+b/c=', isOnSale: '1', storeID: '1', salePrice: '5', normalPrice: '59.99', dealRating: '9', lastChange: now.getTime() / 1000 }, { title: 'Invalid', isOnSale: '1', dealID: 'x', salePrice: '' }])
    const result = normalizeSource(source('cheapshark'), raw, now)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ url: 'https://www.cheapshark.com/redirect?dealID=a%2Bb%2Fc%3D', price: 5, currency: 'USD', sourceSignal: 90, flag: 'chollo' })
  })
  it.each(['reddit-deals', 'reddit-buildapcsales', 'reddit-GameDeals'])('%s reads vote signal and never invents a price', name => {
    const raw = JSON.stringify({ data: { children: [{ data: { title: 'Wireless controller $19.99 (was $79)', url: 'https://shop.test/controller', score: 123, created_utc: now.getTime() / 1000 } }, { data: { title: '60% off sale', url: 'https://shop.test/sale' } }] } })
    expect(normalizeSource(source(name), raw, now)).toMatchObject([{ price: 19.99, listPrice: 79, sourceSignal: 123 }])
  })
  it('Woot rejects sold out and variant price ranges', () => {
    const base = { Title: 'LED smart bulbs 2 pack', Url: 'https://woot.com/offer/bulbs', SalePrice: { Minimum: 5, Maximum: 5 }, ListPrice: { Minimum: 20, Maximum: 20 }, EndDate: '2026-10-08', StartDate: '2026-10-05' }
    const raw = JSON.stringify({ Items: [base, { ...base, IsSoldOut: true }, { ...base, SalePrice: { Minimum: 5, Maximum: 15 } }] })
    expect(normalizeSource(source('woot'), raw, now)).toHaveLength(1)
  })
  it.each(['slickdeals-frontpage', 'slickdeals-popular', 'ebay'])('%s uses the shared RSS adapter', name => {
    const raw = '<rss><channel><item><title>Headphones $15 (was $100)</title><link>https://shop.test/headphones</link><pubDate>Mon, 05 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>'
    expect(normalizeSource(source(name), raw, now)).toMatchObject([{ price: 15, listPrice: 100 }])
  })
  it('rejects invalid envelopes and unsafe XML', () => {
    for (const s of sources) expect(() => normalizeSource(s, '<html>Access denied</html>', now)).toThrow()
    expect(() => normalizeSource(source('dealnews'), '<!DOCTYPE rss><rss></rss>', now)).toThrow()
    expect(() => normalizeSource(source('steam'), '{}', now)).toThrow()
  })
  it('drops unsafe links and invalid prices', () => {
    const src: Source = { name: 'rss-test', kind: 'rss', url: 'https://test/feed' }
    expect(normalizeSource(src, '<rss><channel><item><title>Thing $20</title><link>javascript:alert(1)</link></item></channel></rss>', now)).toEqual([])
  })
})
