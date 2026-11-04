import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { categoryFromSlug, CATEGORY_SLUG_EN, dealAnchor, landingPages, landingPaths, storeSlug } from '../lib/landing'
import { categories } from '../lib/categorize'
import { landingPairs, sitemap } from '../scripts/outputs'
import { buildPayload, DAILY_PATHS, INDEXNOW_KEY } from '../scripts/indexnow'

const deals = [
  { category: 'electronica', store: 'Amazon' },
  { category: 'electronica', store: 'Best Buy' },
  { category: 'videojuegos', store: 'Steam' },
  { category: 'Electronics', store: 'Woot! An Amazon Company' }, // a source label, not ours
  { category: null, store: 'amazon' }, // same slug as Amazon
  { category: null, store: 'Amazon' },
  { category: 'informatica', store: '  ' },
]

describe('landing pages', () => {
  it('slugs store names to ASCII and keeps them stable', () => {
    expect(storeSlug('Best Buy')).toBe('best-buy')
    expect(storeSlug('Woot! An Amazon Company')).toBe('woot-an-amazon-company')
    expect(storeSlug('digitalkeysbox.com')).toBe('digitalkeysbox-com')
    expect(storeSlug('Électronique & Co')).toBe('electronique-and-co')
    expect(storeSlug('!!!')).toBe('')
  })
  it('has an English slug for every category, and maps both ways', () => {
    for (const c of categories) {
      expect(CATEGORY_SLUG_EN[c]).toMatch(/^[a-z-]+$/)
      expect(categoryFromSlug(CATEGORY_SLUG_EN[c], 'en')).toBe(c)
      expect(categoryFromSlug(c, 'es')).toBe(c)
    }
    expect(new Set(Object.values(CATEGORY_SLUG_EN)).size).toBe(categories.length)
    expect(categoryFromSlug('electronics', 'es')).toBeNull()
    expect(categoryFromSlug('nope', 'en')).toBeNull()
  })
  it('lists only categories and stores with deals, merging store spellings', () => {
    const set = landingPages(deals)
    expect(set.categories.map(c => [c.slug, c.enSlug, c.count])).toEqual([
      ['electronica', 'electronics', 2], ['informatica', 'computers', 1], ['videojuegos', 'video-games', 1],
    ])
    expect(set.stores.map(s => [s.slug, s.name, s.count])).toEqual([
      ['amazon', 'Amazon', 3], ['best-buy', 'Best Buy', 1], ['steam', 'Steam', 1], ['woot-an-amazon-company', 'Woot! An Amazon Company', 1],
    ])
    expect(landingPages([])).toEqual({ categories: [], stores: [] })
  })
  it('builds paths in both languages', () => {
    const paths = landingPaths(landingPages([{ category: 'hogar', store: 'Home Depot' }]))
    expect(paths).toEqual([{ es: '/categoria/hogar', en: '/en/category/home' }, { es: '/tienda/home-depot', en: '/en/store/home-depot' }])
  })
  it('makes safe, stable row anchors', () => {
    expect(dealAnchor('99a72f9151f7b90a')).toBe('d-99a72f9151f7b90a')
    expect(dealAnchor('a:b/c d')).toBe('d-a-b-c-d')
  })
})

describe('sitemap with landing pages', () => {
  const at = '2026-11-04T12:00:00.000Z'
  it('adds every category and store page with alternates, and nothing on an empty day', () => {
    const map = sitemap(at, deals)
    for (const loc of ['categoria/electronica/', 'en/category/electronics/', 'tienda/best-buy/', 'en/store/best-buy/', 'tienda/woot-an-amazon-company/']) {
      expect(map).toContain(`<loc>https://barato.si/${loc}</loc>`)
    }
    expect(map).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://barato.si/en/category/video-games/"/>')
    expect(map).not.toContain('categoria/Electronics')
    expect(map).not.toContain('categoria/hogar')
    const pairs = landingPairs(deals).length
    expect(map.match(/<url>/g)).toHaveLength(22 + pairs * 2)
    expect(map.match(/hreflang="x-default"/g)).toHaveLength(16 + pairs * 2)
    expect(sitemap(at, [])).toBe(sitemap(at))
  })
})

describe('IndexNow', () => {
  it('builds the payload from the daily pages and today\'s landing pages', () => {
    const p = buildPayload(deals)
    expect(p.host).toBe('barato.si')
    expect(p.key).toBe(INDEXNOW_KEY)
    expect(p.keyLocation).toBe(`https://barato.si/${INDEXNOW_KEY}.txt`)
    for (const path of DAILY_PATHS) expect(p.urlList).toContain(`https://barato.si${path}`)
    expect(p.urlList).toContain('https://barato.si/categoria/electronica/')
    expect(p.urlList).toContain('https://barato.si/en/store/steam/')
    expect(new Set(p.urlList).size).toBe(p.urlList.length)
    expect(p.urlList.every(u => u.startsWith('https://barato.si/') && u.endsWith('/'))).toBe(true)
    expect(buildPayload([]).urlList).toHaveLength(DAILY_PATHS.length)
  })
  it('has its key file committed in public/', async () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/)
    expect((await readFile(join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`), 'utf8')).trim()).toBe(INDEXNOW_KEY)
  })
})

describe('locale paths for landing pages', async () => {
  const { basePath, localePath } = await import('../app/utils/locale')
  it('pairs Spanish and English category and store paths', () => {
    expect(localePath('/categoria/electronica/', 'en')).toBe('/en/category/electronics')
    expect(localePath('/en/category/video-games', 'es')).toBe('/categoria/videojuegos')
    expect(basePath('/en/category/computers/')).toBe('/categoria/informatica')
    expect(localePath('/tienda/best-buy', 'en')).toBe('/en/store/best-buy')
    expect(localePath('/en/store/best-buy', 'es')).toBe('/tienda/best-buy')
    expect(localePath('/errores', 'en')).toBe('/en/errores')
  })
})

describe('landing JSON-LD', async () => {
  const { breadcrumbLd, ldJson, offerListLd } = await import('../app/composables/useSeo')
  const row = {
    title: 'Monitor 27" <b>', url: 'https://www.dealnews.com/item/1', storeUrl: 'https://www.bestbuy.com/site/1',
    image: null, price: 199, currency: 'USD', store: 'Best Buy',
  }
  const list = { id: 'https://barato.si/tienda/best-buy/#ofertas', name: 'Best Buy: ofertas del 4 de noviembre en barato.si', inLanguage: 'es' }

  it('lists the given rows as Offers, in order, with only real fields', () => {
    const ld = offerListLd([row, { ...row, title: 'Steam game', storeUrl: null, image: 'https://cdn.example/a.jpg', price: 0 }], list)!
    expect(ld).toMatchObject({ '@type': 'ItemList', '@id': list.id, name: list.name, inLanguage: 'es', numberOfItems: 2 })
    expect(ld.itemListOrder).toBeUndefined()
    expect(ld.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, item: { '@type': 'Offer', name: row.title, url: row.storeUrl, price: '199.00', priceCurrency: 'USD', seller: { '@type': 'Organization', name: 'Best Buy' } } },
      { '@type': 'ListItem', position: 2, item: { '@type': 'Offer', name: 'Steam game', url: row.url, image: 'https://cdn.example/a.jpg', price: '0.00', priceCurrency: 'USD', seller: { '@type': 'Organization', name: 'Best Buy' } } },
    ])
    const json = JSON.stringify(ld)
    for (const invented of ['aggregateRating', 'review', 'availability', 'priceValidUntil', 'brand']) expect(json).not.toContain(invented)
  })
  it('leaves out a field with no real value instead of filling it', () => {
    const item = (offerListLd([{ ...row, price: Number.NaN, store: '  ' }], list)!.itemListElement as { item: Record<string, unknown> }[])[0]!.item
    expect(item).toEqual({ '@type': 'Offer', name: row.title, url: row.storeUrl })
  })
  it('gives nothing for an empty list', () => {
    expect(offerListLd([], list)).toBeNull()
  })
  it('marks the order only when asked (the home page ranks by score)', () => {
    expect(offerListLd([row], { ...list, descending: true })!.itemListOrder).toBe('https://schema.org/ItemListOrderDescending')
  })
  it('builds a breadcrumb trail and escapes < for the script tag', () => {
    const trail = [{ name: 'Inicio', url: 'https://barato.si/' }, { name: 'Best Buy', url: 'https://barato.si/tienda/best-buy/' }]
    expect(breadcrumbLd(trail)).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://barato.si/' },
        { '@type': 'ListItem', position: 2, name: 'Best Buy', item: 'https://barato.si/tienda/best-buy/' },
      ],
    })
    expect(breadcrumbLd(trail.slice(0, 1))).toBeNull()
    const out = ldJson(offerListLd([row], list))
    expect(out).not.toContain('<')
    expect(JSON.parse(out).itemListElement[0].item.name).toBe(row.title)
  })
})

describe('landing SEO copy', async () => {
  const { es } = await import('../app/i18n/es')
  const { en } = await import('../app/i18n/en')
  it('names the slice and its count, and says so plainly when it is empty', () => {
    expect(es.landing.seoCatTitle('Electrónica')).toContain('Electrónica')
    expect(es.landing.seoCatDesc('Electrónica', 12)).toMatch(/^12 ofertas de electrónica hoy/)
    expect(es.landing.seoStoreDesc('Best Buy', 1)).toMatch(/^1 oferta de Best Buy hoy/)
    expect(es.landing.seoCatDesc('Electrónica', 0)).toMatch(/^Hoy no hay ofertas de electrónica/)
    expect(es.landing.seoStoreDesc('Best Buy', 0)).toMatch(/^Hoy no hay ofertas de Best Buy/)
    expect(en.landing.seoCatDesc('Electronics', 0)).toMatch(/^No electronics deals/)
    expect(en.landing.seoStoreDesc('Best Buy', 0)).toMatch(/^No deals at Best Buy/)
    for (const s of [es.landing.seoCatTitle('Hogar'), es.landing.seoCatDesc('Hogar', 0), es.landing.seoStoreDesc('Amazon', 3)]) {
      expect(s.toLowerCase()).not.toContain('chollo')
    }
  })
})
