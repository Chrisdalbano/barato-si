import { describe, expect, it } from 'vitest'
import { dropLine, weekTitle } from '../lib/digest'

describe('weekTitle', () => {
  it('drops a bare trailing price (Techbargains titles)', () => {
    expect(weekTitle('Bqevi 2x 7000mAh Battery Powered Smart App Heated Socks $41.29')).toBe('Bqevi 2x 7000mAh Battery Powered Smart App Heated Socks')
    expect(weekTitle('Anyking P7 15.6" Dual 1080p Portable Monitors $129.19')).toBe('Anyking P7 15.6" Dual 1080p Portable Monitors')
    expect(weekTitle('LG fridge $1,549')).toBe('LG fridge')
    expect(weekTitle('Kettle $8 ')).toBe('Kettle')
  })

  it('leaves titles where the price is part of the sentence or the whole title', () => {
    for (const t of [
      'LG 28-cu. ft. 3-Door French Door Refrigerator for $1,549 in cart + free delivery',
      'Echo Dot for $19.99',
      'Gift card now $25',
      'Price drop to $5',
      '$41.29',
      'Monitor 27',
      'Steam Deck 512GB',
      'Lenovo V14 G5 Intel Core i7-13620H 14" 1080p Business Laptop w/ 16GB RAM, 1TB SSD',
    ]) expect(weekTitle(t)).toBe(t)
  })

  it('is what the drop line prints', () => {
    const x = { deal: { title: 'Heated Socks $41.29', store: 'Amazon', currency: 'USD' }, before: 41.29, beforeDate: '2026-11-01', after: 29.49, afterDate: '2026-11-02', pct: 28.6 }
    const line = dropLine(x as unknown as Parameters<typeof dropLine>[0], 'es')
    expect(line.startsWith('Heated Socks (Amazon): de ')).toBe(true)
    expect(line).not.toContain('$41.29')
  })
})
