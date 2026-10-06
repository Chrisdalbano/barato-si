import { readFileSync } from 'node:fs'
import { it, expect } from 'vitest'
import { normalizeSource, type SourceKind } from '../lib/normalize'
import { categorize } from '../lib/categorize'
import { now } from './helpers'
const fixture = (name: string) => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8')
it.each([
  ['Steam', 'steam-search', 'steam-search.json', 5], ['GOG', 'gog', 'gog.json', 3],
  ['Best Buy', 'bestbuy', 'bestbuy.json', 1], ['Woot', 'woot', 'woot.json', 1],
] as const)('normalizes %s with first-party links and HTTPS images', (name, kind, file, count) => {
  const deals = normalizeSource({ name, kind: kind as SourceKind, direct: true, url: 'https://example.com/api' }, fixture(file), now)
  expect(deals).toHaveLength(count)
  for (const d of deals) {
    expect(d.image).toMatch(/^https:\/\//)
    expect(d.storeUrl).toBe(d.url)
    expect(d.storeDomain).toBeTruthy()
    expect(d.listPrice).toBeGreaterThan(d.price)
  }
  if (name === 'Steam') expect(deals[0]).toMatchObject({ title: 'Dead by Daylight', price: 7.99, listPrice: 19.99 })
  if (name === 'GOG') expect(deals[0]).toMatchObject({ price: 1.49, listPrice: 29.59, currency: 'USD' })
})
it('reads RSS 0.91 merchant links and images while dropping Techbargains roundups', () => {
  const deals = normalizeSource({ name: 'Techbargains', kind: 'rss', url: 'https://www.techbargains.com/rss.xml' }, fixture('techbargains.xml'), now)
  expect(deals.length).toBeGreaterThan(0)
  expect(deals.length).toBeLessThan(6)
  for (const d of deals) {
    expect(d.storeUrl).toBe(d.url)
    expect(d.image).toMatch(/^https:\/\//)
    expect(d.storeDomain).toBeTruthy()
    expect(d.sourceUrl).toMatch(/^https:\/\/www.techbargains.com\//)
  }
})
it('normalizes protocol-relative images and rejects HTTP or script images', () => {
  for (const [image, expected] of [['//cdn.test/x.png', 'https://cdn.test/x.png'], ['http://cdn.test/x.png', null], ['javascript:evil()', null]]) {
    const raw = JSON.stringify({ products: [{ name: 'Headphones', salePrice: 1, regularPrice: 10, url: 'https://bestbuy.com/x', image }] })
    expect(normalizeSource({ name: 'Best Buy', kind: 'bestbuy', url: 'https://api.bestbuy.com' }, raw, now)[0]?.image).toBe(expected)
  }
})
it.each([
  ['RTX laptop', null, 'Amazon', 'informatica'], ['Notebook', 'Electronics', 'Best Buy', 'informatica'],
  ['SSD', null, 'Newegg', 'informatica'], ['OLED TV', null, 'Amazon', 'electronica'],
  ['Earbuds', null, 'Amazon', 'electronica'], ['Vacuum cleaner', null, 'Walmart', 'hogar'],
  ['Air fryer', 'Home', 'Amazon', 'cocina'], ['DeWalt drill', null, 'Amazon', 'herramientas'],
  ['Alfani shirt', null, "Macy's", 'ropa'], ['Golf balls', null, 'Amazon', 'deporte'],
  ['LEGO set', null, 'Amazon', 'juguetes'], ['Skincare', null, 'Amazon', 'belleza'],
  ['Coffee pods', null, 'Amazon', 'alimentacion'], ['VPN', null, 'Amazon', 'software'],
  ['Mystery object', null, 'Amazon', 'otros'], ['Office simulator', null, 'Steam', 'videojuegos'],
  ['Something', 'Computers & Tablets', 'Best Buy', 'informatica'], ['Something', 'Clothing', 'Target', 'ropa'],
])('categorizes %s', (title, category, store, expected) => expect(categorize(title!, category, store!)).toBe(expected))
