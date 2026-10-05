import { describe, expect, it } from 'vitest'
import { parsePrices } from '../lib/index'

describe('prices from real-looking offer titles', () => {
  it.each([
    ['$19.99 (was $129)', 19.99, 129, 'USD'],
    ['IHOP Four $25 Gift Cards ($100 Value) for $80', 80, 100, 'USD'],
    ['Spa Essentials Gift Set (a $100 value) for $39.99', 39.99, 100, 'USD'],
    ['Sony Wireless Headphones for $59.99 (reg. $100)', 59.99, 100, 'USD'],
    ['Anker USB-C Dock for $49.99, list $100', 49.99, 100, 'USD'],
    ['Logitech Mechanical Keyboard MSRP $100, now $69.99', 69.99, 100, 'USD'],
    ['Columbia Fleece Jacket (orig. $100) for $45', 45, 100, 'USD'],
    ['Auriculares por 59,99 EUR (a 100 EUR value)', 59.99, 100, 'EUR'],
    ['Gift Set for $80 ($60 Value)', 80, null, 'USD'],
    ['Gift Set for £80 ($100 Value)', 80, null, 'GBP'],
    ['Gift Set for $80 ($100 Value with purchase)', 80, null, 'USD'],
    ['Gift Set for $80 (up to $100 value)', 80, null, 'USD'],
    ['Gift Set for $80 plus $100 value in coupons', 80, null, 'USD'],
    ['Gift Set ($100 Value)', null, null, 'USD'],
    ['Headphones for $60, wishlist $100', 60, null, 'USD'],
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
