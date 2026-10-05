import { describe, expect, it } from 'vitest'
import { parsePrices } from '../lib/index'

describe('prices from real-looking offer titles', () => {
  it.each([
    ['$19.99 (was $129)', 19.99, 129, 'USD'],
    ['USB cable $5 + free shipping', 5, null, 'USD'],
    ['60% off headphones', null, null, 'USD'],
    ['Headphones $40 (60% off)', 40, null, 'USD'],
    ['Was $129, now $19.99', 19.99, 129, 'USD'],
    ['SSD €19,99 (antes €129)', 19.99, 129, 'EUR'],
    ['Monitor 199,99 EUR (RRP 399,99 EUR)', 199.99, 399.99, 'EUR'],
    ['Laptop €1.299,00 (was €1.999,00)', 1299, 1999, 'EUR'],
    ['Laptop $1,299.99 (MSRP $2,000)', 1299.99, 2000, 'USD'],
    ['TV £199.99 (RRP £599)', 199.99, 599, 'GBP'],
    ['Keyboard 19.99 GBP (was 99 GBP)', 19.99, 99, 'GBP'],
    ['TV USD 99 (regular price USD 199)', 99, 199, 'USD'],
    ['Sale: Up to 60% off + free shipping w/ $35', null, null, 'USD'],
    ['Shirt for $7 + free shipping w/ $39', 7, null, 'USD'],
    ['Save $20: headphones for $39.99 (was $80)', 39.99, 80, 'USD'],
    ['$50 off a $300 laptop', 300, null, 'USD'],
    ['Free shipping on headphones', null, null, 'USD'],
    ['Free trial of premium membership', null, null, 'USD'],
    ['Free game: Space Quest (was $19.99)', 0, 19.99, 'USD'],
    ['Game 100% off (was $19.99)', 0, 19.99, 'USD'],
    ['Chair $120 (was $99)', 120, null, 'USD'],
    ['Controller £19.99 (was $80)', 19.99, null, 'GBP'],
    ['RTX 5090 32GB - 60% off', null, null, 'USD'],
    ['$5 shipping; product price varies', null, null, 'USD'],
    ['Gift card $20 with purchase', null, null, 'USD'],
    ['', null, null, 'USD'],
  ])('%s', (title, price, listPrice, currency) => {
    expect(parsePrices(title as string)).toEqual({ price, listPrice, currency })
  })
})
