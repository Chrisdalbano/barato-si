import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeSource, cheapSharkDealId, type Source } from '../lib/normalize'
import { sources } from '../scripts/sources'
import { feedItems } from '../lib/feeds'
import { now } from './helpers'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const source = (name: string): Source => sources.find(s => s.name.toLowerCase() === name.toLowerCase()) || { name, kind: name.startsWith('reddit-') ? 'reddit' : name === 'woot' ? 'woot' : 'rss', url: 'https://test.example/feed' }

describe('real response fixtures (captured 2026-10-05)', () => {
  it('normalizes DealNews and preserves exact attribution, links, and original XML', () => {
    const raw = fixture('dealnews.xml')
    const deals = normalizeSource(source('dealnews'), raw, now)
    expect(deals.length).toBeGreaterThan(0)
    for (const d of deals) {
      expect(d.url).toContain('iref=')
      expect(d.syndication?.attribution).toBe('DealNews')
      expect(d.syndication?.feedUrl).toBe(source('dealnews').url)
      expect(d.sourceUrl).toMatch(/^https:\/\/www\.dealnews\.com\/\d+\.html\?iref=rss$/)
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
  it.each([
    ['<guid>https://www.dealnews.com/123.html?iref=rss</guid>', 'https://shop.test/offer', 'https://www.dealnews.com/123.html?iref=rss'],
    ['<guid>opaque-id</guid>', 'https://www.dealnews.com/offer/123.html', 'https://www.dealnews.com/offer/123.html'],
    ['<guid>javascript:alert(1)</guid>', 'https://shop.test/offer', 'https://www.dealnews.com/'],
    ['<guid>https://www.dealnews.com.evil.test/123.html</guid>', 'https://shop.test/offer', 'https://www.dealnews.com/'],
    ['', 'https://shop.test/offer', 'https://www.dealnews.com/'],
  ])('uses a source item page or homepage for attribution (%s)', (guid, url, sourceUrl) => {
    const raw = `<rss><channel><item><title>IHOP Four $25 Gift Cards ($100 Value) for $80</title><link>${url}</link>${guid}</item></channel></rss>`
    expect(normalizeSource(source('dealnews'), raw, now)).toMatchObject([
      { url, sourceUrl, price: 80, listPrice: 100, discountPct: 20, syndication: { feedUrl: source('dealnews').url } },
    ])
  })
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

it('ITAD preserves links and rejects expired or non-discounted offers (synthetic documented schema)', () => {
  const src: Source = { name: 'IsThereAnyDeal', kind: 'itad', url: 'https://api.isthereanydeal.com/deals/v2' }
  const offer = { title: 'Example game', deal: { shop: { name: 'GOG' }, price: { amount: 5, currency: 'USD' }, regular: { amount: 50, currency: 'USD' }, cut: 90, url: 'https://itad.link/example/?affiliate=keep', expiry: '2026-10-07T00:00:00Z' } }
  const result = normalizeSource(src, JSON.stringify({ list: [offer, { ...offer, deal: { ...offer.deal, expiry: '2026-10-01' } }, { ...offer, deal: { ...offer.deal, cut: 0 } }] }), now)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ store: 'GOG', source: 'IsThereAnyDeal', price: 5, url: offer.deal.url, flag: 'chollo' })
})
it.each([['7', 'GOG'], ['11', 'Humble Store'], ['15', 'Fanatical']])('maps CheapShark store %s to %s', (storeID, store) => {
  const result = normalizeSource(source('cheapshark'), JSON.stringify([{ title: 'Example', dealID: 'abc', storeID, isOnSale: '1', salePrice: '1', normalPrice: '10' }]), now)
  expect(result[0]).toMatchObject({ source: 'CheapShark', store })
})

it('encodes CheapShark redirect IDs exactly once', () => {
  expect(cheapSharkDealId('abc%2Bdef%3D')).toBe('abc%2Bdef%3D')
  expect(cheapSharkDealId('abc+def=')).toBe('abc%2Bdef%3D')
})
