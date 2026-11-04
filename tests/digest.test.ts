import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildWeek, isoWeek, weekCopy, weekText, dropLine, lowLine } from '../lib/digest'
import { HOUSE_RULES_EN, HOUSE_RULES_ES } from '../lib/don-centavo'
import { categories } from '../lib/categorize'
import { feedItems } from '../lib/feeds'
import { scorecard, type OracleLog } from '../lib/oracle'
import { feedList, retainCollected, sliceFeed, sliceFeeds, SLICE_FEED_MAX, weekRss, writeOutputs } from '../scripts/outputs'
import type { OracleFile, PriceLedger } from '../lib/types'
import { deal } from './helpers'
import { es } from '../app/i18n/es'
import { en } from '../app/i18n/en'

const now = new Date('2026-11-04T12:00:00Z')
const TODAY = '2026-11-04'
const ledgerOf = (products: PriceLedger['products']): PriceLedger => ({ version: 1, updatedAt: now.toISOString(), products })
const rows = (pairs: [string, number][]) => pairs.map(([d, p]) => ({ d, p, s: 'test' }))

// B1 fell 30 % on 11-03 after a flat series (a drop, not a low: the series never moved before).
// B2 hit 95 on 11-02 after moving between 100 and 120 (a low, and a 13.6 % drop against 110).
// B3 moved 5 %: under the 10 % bar, not a drop.
const ledger = ledgerOf({
  'asin:B000000001': { title: 'Monitor 27', currency: 'USD', firstSeen: '2026-10-20', series: rows([['2026-10-20', 100], ['2026-10-25', 100], ['2026-11-01', 100], ['2026-11-03', 70]]) },
  'asin:B000000002': { title: 'Robot vacuum', currency: 'USD', firstSeen: '2026-10-10', series: rows([['2026-10-10', 120], ['2026-10-15', 100], ['2026-10-20', 110], ['2026-11-02', 95]]) },
  'asin:B000000003': { title: 'Kettle', currency: 'USD', firstSeen: '2026-10-30', series: rows([['2026-10-30', 100], ['2026-11-01', 95]]) },
})
const b1 = (price: number) => deal({ id: 'b1', title: 'Monitor 27', productKey: 'asin:B000000001', price, store: 'Amazon', category: 'electronica' })
const b2 = deal({ id: 'b2', title: 'Robot vacuum', productKey: 'asin:B000000002', price: 95, store: 'Amazon', category: 'hogar' })
const b3 = deal({ id: 'b3', title: 'Kettle', productKey: 'asin:B000000003', price: 95, store: 'Target', category: 'cocina' })
const laptop = deal({ id: 'past', title: 'Lenovo laptop RTX 4060', price: 99, listPrice: 1199, discountPct: 91.74, category: 'informatica', errorScore: 55, store: 'Best Buy' })
const retracted = deal({ id: 'meh', title: 'Socks', price: 20, listPrice: 25, discountPct: 20, errorScore: 60 })
const archives = [
  { date: '2026-10-25', deals: [deal({ id: 'old', productKey: 'asin:B0000000OLD' })] }, // outside the window
  { date: '2026-11-01', deals: [b1(100)] },
  { date: '2026-11-02', deals: [b2] },
  { date: '2026-11-03', deals: [b1(70), laptop, retracted] },
  { date: TODAY, deals: [b3] },
]
const log: OracleLog = { version: 1, entries: [
  { date: TODAY, productKey: 'asin:B000000001', dealId: 'b1', currency: 'USD', price: 70, pDrop: .1, baseRate: .04, horizonDays: 14, dropThresholdPct: 5, verdict: 'aprendiendo' },
  { date: TODAY, productKey: 'asin:B000000002', dealId: 'b2', currency: 'USD', price: 95, pDrop: .1, baseRate: .04, horizonDays: 14, dropThresholdPct: 5, verdict: 'aprendiendo' },
] }
const oracle: OracleFile = {
  version: 1, date: TODAY, generatedAt: now.toISOString(), model: 'm', horizonDays: 14, dropThresholdPct: 5,
  predictions: [
    { dealId: 'b1', productKey: 'asin:B000000001', title: 'Monitor 27', price: 70, currency: 'USD', pDrop: .1, horizonDays: 14, verdict: 'aprendiendo', basis: { observations: 0, priorAlpha: 1, priorBeta: 1, category: null } },
    { dealId: 'b2', productKey: 'asin:B000000002', title: 'Robot vacuum', price: 95, currency: 'USD', pDrop: .6, horizonDays: 14, verdict: 'espera', basis: { observations: 2, priorAlpha: 1, priorBeta: 1, category: null } },
  ],
  scorecard: scorecard(log),
}
const cache = { past: { price: 99, date: '2026-11-03T05:00:00Z', ai: { product: 'Lenovo laptop', category: 'informatica' as const, verdict: 'error' as const, confidence: .8, note: 'Portátil con RTX a menos de 100 USD: parece un error.', model: 'm' } } }

describe('the weekly digest', () => {
  const w = buildWeek({ archives, ledger, oracle, log, cache, now })
  it('covers the last seven UTC days, today included, and counts what was published in them', () => {
    expect([w.from, w.to, w.isoWeek, w.days]).toEqual(['2026-10-29', TODAY, '2026-W45', 4])
    expect(w.products).toBe(5) // b1, b2, b3, the laptop and the socks; "old" is outside
  })
  it('lists observed drops of 10 % or more, largest first, against the previous observed day', () => {
    expect(w.drops.map(d => [d.deal.id, d.pct, d.before, d.beforeDate, d.after, d.afterDate])).toEqual([
      ['b1', 30, 100, '2026-11-01', 70, '2026-11-03'],
      ['b2', 13.6, 110, '2026-10-20', 95, '2026-11-02'],
    ])
  })
  it('lists recorded lows only in series that moved, with at least three prior days', () => {
    expect(w.lows.map(l => [l.deal.id, l.price, l.date, l.priorDays, l.priorLow, l.priorHigh])).toEqual([['b2', 95, '2026-11-02', 3, 100, 120]])
  })
  it('repeats only error candidates that survive today\'s rules, quoting the cached classifier note', () => {
    expect(w.errors.map(e => e.deal.id)).toEqual(['past'])
    expect(w.errors[0]!.errorScore).toBeGreaterThanOrEqual(40)
    expect(w.errors[0]!.note).toBe('Portátil con RTX a menos de 100 USD: parece un error.')
  })
  it('reports the forecast in counts until something resolves, with the first due date', () => {
    expect(w.forecast).toEqual({ predictions: 2, espera: 1, compra: 0, aprendiendo: 1, logged: 2, resolved: 0, dropped: 0, firstDue: '2026-11-19', scorecard: null })
    const c = weekCopy(w, 'es')
    expect(c.forecast.lines.join(' ')).toContain('Las primeras notas llegan el 19 nov.')
    expect(weekCopy(w, 'en').forecast.lines.join(' ')).toContain('The first grades arrive on Nov 19.')
  })
  it('rotates Don Centavo\'s rule with the ISO week, from the shared list the site uses', () => {
    expect(w.rule).toEqual({ n: 4, es: HOUSE_RULES_ES[3], en: HOUSE_RULES_EN[3] })
    expect(es.lore.rules).toEqual(HOUSE_RULES_ES)
    expect(en.lore.rules).toEqual(HOUSE_RULES_EN)
  })
  it('says so when the week is short, and when it is quiet', () => {
    expect(weekCopy(w, 'es').thin).toBe('Semana corta: solo hay 4 días publicados en esta ventana. Lo que sigue es lo que hay.')
    const empty = buildWeek({ archives: [], ledger: ledgerOf({}), now })
    expect([empty.days, empty.products, empty.drops, empty.lows, empty.errors]).toEqual([0, 0, [], [], []])
    expect(weekCopy(empty, 'es').thin).toContain('Una semana tranquila')
    expect(weekCopy(empty, 'en').forecast.lines).toEqual(['The model published no predictions today.', 'Nothing to grade yet.'])
    const text = weekText(empty, 'es')
    for (const line of ['Ninguna caída del 10 % o más esta semana.', 'Ningún producto tocó su mínimo registrado', 'Ningún candidato de la semana aguanta']) expect(text).toContain(line)
  })
  it('grades the model in the copy once predictions resolve, better or worse', () => {
    const graded = { ...w, forecast: { ...w.forecast, resolved: 3, dropped: 1, scorecard: { resolved: 3, brier: .2, baselineBrier: .1, buckets: [], since: '2026-10-20' } } }
    const line = weekCopy(graded, 'es').forecast.lines.join(' ')
    expect(line).toContain('Vencieron 3 predicciones esta semana; en 1 llegó la bajada.')
    expect(line).toContain('Brier 0,2 contra 0,1 de la línea base. Peor que la línea base, y lo decimos igual.')
  })
  it('writes item lines with observed prices and dates', () => {
    const sp = (t: string) => t.replace(/[  ]/g, ' ')
    expect(sp(dropLine(w.drops[0]!, 'es'))).toBe('Monitor 27 (Amazon): de 100,00 US$ el 1 nov a 70,00 US$ el 3 nov, −30 %.')
    expect(sp(lowLine(w.lows[0]!, 'en'))).toBe('Robot vacuum (Amazon): $95.00 on Nov 2; before, between $100.00 and $120.00 over 3 observed days.')
  })
  it('numbers ISO weeks across year ends', () => {
    expect(isoWeek('2026-01-01')).toBe('2026-W01')
    expect(isoWeek('2027-01-01')).toBe('2026-W53')
    expect(isoWeek('2026-11-02')).toBe('2026-W45')
    expect(isoWeek('2026-11-08')).toBe('2026-W45')
    expect(isoWeek('2026-11-09')).toBe('2026-W46')
  })
  it('publishes one RSS item per ISO week, valid and escaped', () => {
    const xml = weekRss(w)
    expect(feedItems(xml)).toHaveLength(1)
    expect(xml).toContain('<guid isPermaLink="false">barato.si/semana/2026-W45</guid>')
    expect(xml).toContain('<atom:link href="https://barato.si/semana.xml" rel="self"')
    expect(xml).toContain('La semana de Don Centavo, 29 oct – 4 nov')
    expect(xml).not.toMatch(/<description>[^<]*<[a-z]/)
  })
})

describe('slice feeds', () => {
  const deals = [
    deal({ id: 'e1', category: 'electronica', store: 'Amazon' }),
    deal({ id: 'g1', category: 'videojuegos', store: 'Steam' }),
  ]
  it('writes every category, every store of today and of the archive, empty when there is nothing today', () => {
    const feeds = new Map(sliceFeeds(deals, now.toISOString(), [{ store: 'Best Buy' }, { store: 'amazon' }, { store: ' ' }]))
    expect([...feeds.keys()].filter(p => p.startsWith('/feeds/categoria/'))).toHaveLength(categories.length)
    expect([...feeds.keys()].filter(p => p.startsWith('/feeds/tienda/'))).toEqual(['/feeds/tienda/amazon.xml', '/feeds/tienda/best-buy.xml', '/feeds/tienda/steam.xml'])
    expect(feedItems(feeds.get('/feeds/categoria/electronica.xml')!)).toHaveLength(1)
    expect(feedItems(feeds.get('/feeds/categoria/hogar.xml')!)).toHaveLength(0)
    expect(feedItems(feeds.get('/feeds/tienda/best-buy.xml')!)).toHaveLength(0)
    const amazon = feeds.get('/feeds/tienda/amazon.xml')!
    expect(amazon).toContain('<title>barato.si — Amazon</title><link>https://barato.si/tienda/amazon/</link>')
    expect(amazon).toContain('<atom:link href="https://barato.si/feeds/tienda/amazon.xml" rel="self"')
    expect(feeds.get('/feeds/categoria/electronica.xml')).toContain('<title>barato.si — Electrónica</title>')
  })
  it('caps a feed and escapes store names', () => {
    const many = Array.from({ length: 80 }, (_, i) => deal({ id: `x${i}`, category: 'hogar', store: 'A&B <Shop>' }))
    const xml = sliceFeed('tienda', 'a-and-b-shop', 'A&B <Shop>', many, now.toISOString())
    expect(feedItems(xml)).toHaveLength(SLICE_FEED_MAX)
    expect(xml).toContain('barato.si — A&amp;B &lt;Shop&gt;')
  })
  it('lists today\'s feeds for llms.txt', () => {
    expect(feedList(deals)).toEqual([
      'https://barato.si/feeds/categoria/electronica.xml — Electrónica (1)',
      'https://barato.si/feeds/categoria/videojuegos.xml — Videojuegos (1)',
      'https://barato.si/feeds/tienda/amazon.xml — Amazon (1)',
      'https://barato.si/feeds/tienda/steam.xml — Steam (1)',
    ])
  })
})

describe('outputs with the digest and feeds', () => {
  it('writes week.json, semana.xml and the feeds, prunes feeds it did not write, and lists them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'barato-week-'))
    try {
      await mkdir(join(root, 'api/deals'), { recursive: true })
      await mkdir(join(root, 'feeds/tienda'), { recursive: true })
      await writeFile(join(root, 'feeds/tienda/gone.xml'), 'old')
      await writeFile(join(root, 'api/deals/2026-11-03.json'), JSON.stringify({ date: '2026-11-03', deals: [deal({ id: 'w', store: 'Woot' })] }))
      const d = deal({ id: 'e1', category: 'electronica', store: 'Amazon' })
      const file = { version: 3 as const, date: TODAY, generatedAt: now.toISOString(), count: 1, sources: [], deals: [d] }
      retainCollected(file, [d])
      const week = buildWeek({ archives, ledger, oracle, log, cache, now })
      await writeOutputs(root, file, { week })
      expect(JSON.parse(await readFile(join(root, 'api/week.json'), 'utf8'))).toEqual(week)
      expect(feedItems(await readFile(join(root, 'semana.xml'), 'utf8'))).toHaveLength(1)
      expect((await readdir(join(root, 'feeds/tienda'))).sort()).toEqual(['amazon.xml', 'woot.xml'])
      expect(await readdir(join(root, 'feeds/categoria'))).toHaveLength(categories.length)
      const llms = await readFile(join(root, 'llms.txt'), 'utf8')
      for (const text of ['https://barato.si/api/week.json', 'https://barato.si/semana.xml', '## Feeds de hoy', 'https://barato.si/feeds/categoria/electronica.xml — Electrónica (1)', 'https://barato.si/feeds/tienda/amazon.xml — Amazon (1)']) expect(llms).toContain(text)
      const map = await readFile(join(root, 'sitemap.xml'), 'utf8')
      for (const loc of ['semana/', 'en/week/', 'anunciate/', 'en/advertise/', 'semana.xml', 'api/week.json']) expect(map).toContain(`<loc>https://barato.si/${loc}</loc>`)
    } finally { await rm(root, { recursive: true }) }
  })
  it('leaves week.json and semana.xml alone when no digest is passed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'barato-week-'))
    try {
      const file = { version: 3 as const, date: TODAY, generatedAt: now.toISOString(), count: 0, sources: [], deals: [] }
      await writeOutputs(root, file)
      await expect(readFile(join(root, 'api/week.json'), 'utf8')).rejects.toThrow()
      expect(await readFile(join(root, 'llms.txt'), 'utf8')).not.toContain('api/week.json')
    } finally { await rm(root, { recursive: true }) }
  })
})

describe('the site reads week.json defensively', () => {
  it('round-trips a real digest, drops malformed rows and rejects a wrong file', async () => {
    const { normalizeWeek, normalizeOracle } = await import('../app/utils/extras')
    const { basePath, localePath } = await import('../app/utils/locale')
    const w = buildWeek({ archives, ledger, oracle, log, cache, now })
    expect(normalizeWeek(JSON.parse(JSON.stringify(w)))).toEqual(w)
    const broken = { ...w, drops: [{ deal: { id: 'x', title: 'y', url: 'javascript:alert(1)' }, before: 1, after: 0.5, pct: 50, beforeDate: TODAY, afterDate: TODAY }, 'nope', ...w.drops], lows: null }
    const read = normalizeWeek(broken)!
    expect(read.drops.map(d => d.deal.id)).toEqual(w.drops.map(d => d.deal.id))
    expect(read.lows).toEqual([])
    expect(normalizeWeek({ version: 2 })).toBeNull()
    expect(normalizeWeek(null)).toBeNull()
    expect(normalizeOracle(oracle)!.scorecard.firstDue).toBe('2026-11-19')
    expect([localePath('/semana', 'en'), localePath('/anunciate', 'en'), basePath('/en/week'), basePath('/en/advertise/')]).toEqual(['/en/week', '/en/advertise', '/semana', '/anunciate'])
  })
})
