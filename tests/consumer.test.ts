import { describe, expect, it } from 'vitest'
import { applyGate, rejection, tradeItem } from '../lib/interest'
import { roundup } from '../lib/errors'
import { categorize } from '../lib/categorize'
import { deal } from './helpers'

// 2026-11-24: the page is for shoppers. Titles below are the rows that led the live page on 2026-11-23.
const now = new Date('2026-11-24T05:00:00Z')
const camel = (o: Parameters<typeof deal>[0] = {}) => deal({
  source: 'CamelCamelCamel', store: 'Amazon', storeDomain: 'amazon.com', url: 'https://www.amazon.com/dp/B000000001', storeUrl: 'https://www.amazon.com/dp/B000000001',
  direct: true, price: 99, listPrice: null, discountPct: null, publishedAt: now.toISOString(),
  reference: { price: 400, kind: 'source-previous', asOf: '2026-11-24', note: 'Precio anterior comunicado por CamelCamelCamel' }, referenceDiscountPct: 75, ...o,
})

describe('consumer gate', () => {
  it('recognises trade, clinical and datacenter goods by their titles', () => {
    for (const title of [
      'XPOWER F-16B ULV Cold Fogger, ...Capacity, Rechargeable Battery', 'StarTech.com 10GBASE-ER SFP+ T... km - MSA Compliant Fiber SFP+',
      'Brother TD-4750TNWB Thermal Transfer Label Printer', 'MABIS Disposable Sphygmomanome... (Pack of 40, 200 Count Total)',
      'Garmin Blaze Equine Wellness System', 'Keurig K-3550 Large Business S...e Maker, Plumbed, Silver/Black', 'Sotera Chemical Transfer Pump ...Discharge Hose & Manual Nozzle', 'Supermicro CSE-747BTQ-R2K04B 4U Chassis',
      'Eaton Tripp Lite 42U Standard-...-lb. capacity, Black (SR42UBG)', 'Hoshizaki B-300SF S/S 300 Pound Capacity Ice Storage Bin', 'Metra 957643 Stereo Installati...san Pathfinder 2013-2020-Black',
    ]) expect(tradeItem(title), title).toBe(true)
  })
  it('leaves ordinary shopping alone', () => {
    for (const title of [
      'Apple AirPods Pro 3 Active Noise Cancellation Wireless Earbuds $149', 'LEGO 21061 Architecture NotreDame de Paris', 'Brother P-touch label maker',
      'Vitamix 5200 Blender Professional-Grade', 'Energizer AA Batteries (Pack of 24)', 'Samsung 9100 PRO 1TB PCIe 5.0x4 M.2 2280 Internal Solid State Hard Drive',
      'Netgear 8-Port Gigabit Ethernet Switch', 'Lenovo V14 G5 Intel Core i7-13620H 14" 1080p Business Laptop w/ 16GB RAM, 1TB SSD $629', 'Dewalt 20V MAX Cordless Drill & Impact Driver with 2x Batteries',
    ]) expect(tradeItem(title), title).toBe(false)
  })
  it('rejects a trade item even when its cut looks like a price error', () => {
    const sfp = camel({ title: 'StarTech.com 10GBASE-ER SFP+ T... km - MSA Compliant Fiber SFP+', category: 'otros', errorScore: 54 })
    expect(rejection({ ...sfp, interest: 50 }, now)).toBe('not-consumer')
  })
  it('publishes an unedited Amazon drop only with a known name or from an aisle people browse', () => {
    const rows = [
      camel({ id: 'vent', title: 'Dryer Vent Hood Assembly Brown', category: 'hogar', url: 'https://www.amazon.com/dp/B000000002', storeUrl: 'https://www.amazon.com/dp/B000000002' }),
      camel({ id: 'glasses', title: 'Peepers Blue Light Reading Gla... +2.25, Green Tortoise, Bengal', category: 'salud', price: 20, url: 'https://www.amazon.com/dp/B000000003', storeUrl: 'https://www.amazon.com/dp/B000000003' }),
      camel({ id: 'lego', title: 'LEGO 21061 Architecture NotreDame de Paris', category: 'juguetes', url: 'https://www.amazon.com/dp/B000000004', storeUrl: 'https://www.amazon.com/dp/B000000004' }),
      camel({ id: 'bat', title: 'Louisville Slugger 2026 Select...) USA Baseball Bat - 28"/18 oz', category: 'deporte', price: 160, url: 'https://www.amazon.com/dp/B000000005', storeUrl: 'https://www.amazon.com/dp/B000000005' }),
      camel({ id: 'px8', title: 'Bowers & Wilkins Px8 S2 Wirele...e, USB-C 15-Min Quick Charging', category: 'electronica', price: 300, url: 'https://www.amazon.com/dp/B000000006', storeUrl: 'https://www.amazon.com/dp/B000000006' }),
    ]
    const { kept, gate } = applyGate(rows, now)
    expect(kept.map(d => d.id).sort()).toEqual(['bat', 'lego', 'px8'])
    expect(gate.byReason['unvetted-drop']).toBe(2)
  })
  it('does not ask an edited source for a known name', () => {
    const row = deal({ id: 'tb', source: 'Techbargains', title: 'Byeshop 1350W 20 Bar Compact Espresso Coffee Machine', category: 'cocina', price: 64, listPrice: 130, discountPct: 51, direct: true, storeDomain: 'shop.test', storeUrl: 'https://shop.test/item/100', publishedAt: now.toISOString() })
    expect(applyGate([row], now).kept).toHaveLength(1)
  })
  it('treats bare part numbers and add-on accessories as parts', () => {
    for (const title of ['Frigidaire 316650003 Control Board', 'Bosch 00499500 Dishwasher Water-Level Sensor', 'EcoFlow Remote Control (Recommended Accessory)', 'Spool Holders for Centauri Carbon 2 Combo'])
      expect(rejection({ ...deal({ title, source: 'Techbargains', category: 'hogar', price: 60, publishedAt: now.toISOString() }), interest: 80 }, now), title).toBe('replacement-part')
  })
  it('reads "Sale:" and "Deals:" headlines as roundups, not products', () => {
    expect(roundup('Kindle Black Friday Sale: Kindle $120  | Kindle Scribe $350 | Kindle Kids $150')).toBe(true)
    expect(roundup('Walmart Black Friday TV Deals: 55" 4K Roku Smart TV Starting $168')).toBe(true)
    expect(roundup('Samsung 65" The Frame QLED 4K Smart TV $998')).toBe(false)
  })
  it('files bats, drivers and synths where a shopper would look', () => {
    expect(categorize('Easton | 2025 | The Dub Baseba...Drop | 2 3/4" Barrel | 32 Inch', null, 'Amazon')).toBe('deporte')
    expect(categorize('MOOG Mavis Semi-Modular Analog Synthesizer', null, 'Amazon')).toBe('ocio')
  })
})
