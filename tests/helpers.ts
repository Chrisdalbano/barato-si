import type { Deal } from '../lib/types'
export const now = new Date('2026-10-05T22:00:00Z')
export function deal(overrides: Partial<Deal> = {}): Deal {
  return { id: 'a', title: 'Wireless headphones model 100', url: 'https://shop.test/item/100', storeUrl: null, storeDomain: null, store: 'Shop', source: 'test', sourceUrl: 'https://feed.test/rss', currency: 'USD', price: 20, listPrice: 100, discountPct: 80, image: null, category: null, publishedAt: now.toISOString(), foundAt: now.toISOString(), score: 0, errorScore: 0, errorSignals: [], flag: 'normal', reasons: [], ...overrides }
}
