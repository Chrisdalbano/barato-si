import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { productWindows, fitPrior, fitOracle, predict, appendLog, resolveLog, scorecard, buildOracle, emptyOracleLog, STRENGTH_DEFAULT, STRENGTH_MAX, STRENGTH_MIN, type OracleLog } from '../lib/oracle'
import { buildHighlights, dropVsLast } from '../lib/highlights'
import { recentCandidates, nearestMisses } from '../lib/error-feed'
import { scoreError } from '../lib/errors'
import { interestOf } from '../lib/interest'
import { writeOutputs, retainCollected, sitemap } from '../scripts/outputs'
import type { Deal, PriceLedger } from '../lib/types'
import { deal } from './helpers'

const now = new Date('2026-11-04T12:00:00Z')
const TODAY = '2026-11-04'
const day = (offset: number, from = '2026-09-01') => new Date(Date.parse(from + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
const ledgerOf = (products: PriceLedger['products']): PriceLedger => ({ version: 1, updatedAt: now.toISOString(), products })
const series = (prices: number[], every = 5) => prices.map((p, i) => ({ d: day(i * every), p, s: 'test' }))

describe('oracle windows', () => {
  const rows = [{ d: '2026-10-01', p: 100 }, { d: '2026-10-05', p: 94 }, { d: '2026-10-16', p: 100 }, { d: '2026-10-20', p: 100 }]
  it('counts completed, non-overlapping windows with a later observation', () => {
    expect(productWindows(rows, TODAY)).toEqual({ n: 2, k: 1 })
    // The second window (10-16 .. 10-30) has not closed on 10-20: it is not a trial yet.
    expect(productWindows(rows, '2026-10-20')).toEqual({ n: 1, k: 1 })
  })
  it('treats exactly the threshold as a drop and a cent above as not', () => {
    expect(productWindows([{ d: '2026-10-01', p: 100 }, { d: '2026-10-03', p: 95 }], TODAY).k).toBe(1)
    expect(productWindows([{ d: '2026-10-01', p: 100 }, { d: '2026-10-03', p: 95.01 }], TODAY).k).toBe(0)
  })
  it('skips anchors with nothing observed inside their horizon and ignores today', () => {
    expect(productWindows([{ d: '2026-09-01', p: 100 }, { d: '2026-10-01', p: 50 }], TODAY)).toEqual({ n: 0, k: 0 })
    expect(productWindows([{ d: '2026-10-21', p: 100 }, { d: TODAY, p: 10 }], TODAY)).toEqual({ n: 0, k: 0 })
  })
})

describe('method-of-moments prior', () => {
  it('returns null without data and the default strength when rho is not identifiable', () => {
    expect(fitPrior([])).toBeNull()
    const p = fitPrior([{ n: 1, k: 1 }, { n: 1, k: 0 }, { n: 1, k: 0 }, { n: 1, k: 0 }])!
    expect(p.mean).toBe(.25)
    expect(p.alpha + p.beta).toBeCloseTo(STRENGTH_DEFAULT)
    expect(p.alpha).toBeCloseTo(2.5)
  })
  it('weakens the prior for overdispersed products and strengthens it for homogeneous ones, within bounds', () => {
    const split = fitPrior([...Array(5)].flatMap(() => [{ n: 4, k: 4 }, { n: 4, k: 0 }]))!
    expect(split.alpha + split.beta).toBeCloseTo(STRENGTH_MIN)
    const same = fitPrior([...Array(10)].map(() => ({ n: 4, k: 2 })))!
    expect(same.alpha + same.beta).toBeCloseTo(STRENGTH_MAX)
    expect(same.alpha).toBeCloseTo(25)
  })
  it('floors the mean so a category with no drops still has a positive alpha', () => {
    const none = fitPrior([...Array(20)].map(() => ({ n: 1, k: 0 })))!
    expect(none.mean).toBe(0)
    expect(none.alpha).toBeGreaterThan(0)
  })
})

// 60 laptops observed every 5 days from 09-01 to 10-16: three completed windows each.
// Every fourth one falls 6 % per observation (drops in every window); the rest hold at 100.
// Pooled: 30 drops in 180 windows, overdispersed, so the prior is the weakest allowed (strength 2).
function richLedger(): PriceLedger {
  const products: PriceLedger['products'] = {}
  for (let i = 0; i < 60; i++) products['asin:B00000' + String(i).padStart(4, '0')] = { title: 'Lenovo laptop ' + i, currency: 'USD', firstSeen: '2026-09-01', series: series([...Array(10)].map((_, j) => i % 4 === 0 ? Math.round(100 * .94 ** j * 100) / 100 : 100)) }
  return ledgerOf(products)
}
const tracked = (i: number, extra: Partial<Deal> = {}) => deal({ id: 'd' + i, title: 'Lenovo laptop ' + i, category: 'informatica', price: 100, productKey: 'asin:B00000' + String(i).padStart(4, '0'), ...extra })

describe('oracle predictions', () => {
  it('fits a category prior and answers only for products with enough own windows', () => {
    const ledger = richLedger(), model = fitOracle(ledger, TODAY)
    expect(model.global!.windows).toBe(180)
    expect(model.byCategory.informatica).toMatchObject({ mean: .25, alpha: .5, beta: 1.5, windows: 180, products: 60 })
    const dropper = predict(tracked(0), ledger, model)!, holder = predict(tracked(1), ledger, model)!
    expect(dropper.basis).toMatchObject({ observations: 3, category: 'informatica' })
    // (alpha + k) / (alpha + beta + n): (0.5 + 3) / 5 and 0.5 / 5.
    expect(dropper.pDrop).toBe(.7)
    expect(holder.pDrop).toBe(.1)
    expect(dropper.verdict).toBe('espera')
    expect(holder.verdict).toBe('compra')
    expect(dropper.pDrop).toBeLessThanOrEqual(1)
  })
  it('says aprendiendo with thin pooled data, and skips untracked products and other currencies', () => {
    const thin = ledgerOf({ 'asin:B000000001': { title: 'Lenovo laptop', currency: 'USD', firstSeen: '2026-09-01', series: series([100, 90, 100, 90, 100, 90, 100]) } })
    const p = predict(tracked(1, { productKey: 'asin:B000000001' }), thin, fitOracle(thin, TODAY))!
    expect(p.verdict).toBe('aprendiendo')
    expect(p.basis).toMatchObject({ priorAlpha: 1, priorBeta: 1, category: null })
    const ledger = richLedger(), model = fitOracle(ledger, TODAY)
    expect(predict(tracked(1, { productKey: 'asin:B0NOTTRACK' }), ledger, model)).toBeNull()
    expect(predict(tracked(1, { currency: 'EUR' }), ledger, model)).toBeNull()
    expect(predict(deal({ id: 'g', category: 'videojuegos', productKey: 'steam:1' }), ledger, model)).toBeNull()
  })
  it('builds a file sorted by pDrop, one per product, and logs one prediction per product per day', () => {
    const ledger = richLedger()
    const deals = [tracked(1), tracked(0), tracked(0, { id: 'dup' }), deal({ id: 'loose' })]
    const first = buildOracle(deals, ledger, emptyOracleLog(), now)
    expect(first.file.predictions.map(p => p.dealId)).toEqual(['d0', 'd1'])
    expect(first.file).toMatchObject({ version: 1, date: TODAY, horizonDays: 14, dropThresholdPct: 5, model: 'beta-binomial empirical Bayes v1' })
    expect(first.file.scorecard).toEqual({ resolved: 0, brier: null, baselineBrier: null, since: null, firstDue: '2026-11-19', buckets: [0, 1, 2, 3, 4].map(i => ({ lo: i / 5, hi: (i + 1) / 5, n: 0, hitRate: null })) })
    expect(first.log.entries).toHaveLength(2)
    const again = buildOracle(deals.map(d => ({ ...d, price: 50 })), ledger, first.log, new Date('2026-11-04T21:00:00Z'))
    expect(again.log.entries).toHaveLength(2)
    expect(again.log.entries.every(e => e.price === 100)).toBe(true)
  })
})

describe('self-scoring', () => {
  const entry = (productKey: string, pDrop: number, date = '2026-10-01') => ({ date, productKey, dealId: productKey, currency: 'USD', price: 100, pDrop, baseRate: .5, horizonDays: 14, dropThresholdPct: 5, verdict: 'aprendiendo' as const })
  const ledger = ledgerOf({
    'k:drop': { title: 'a', currency: 'USD', firstSeen: '2026-10-01', series: [{ d: '2026-10-01', p: 100, s: 't' }, { d: '2026-10-10', p: 80, s: 't' }] },
    'k:flat': { title: 'b', currency: 'USD', firstSeen: '2026-10-01', series: [{ d: '2026-10-01', p: 100, s: 't' }, { d: '2026-10-10', p: 99, s: 't' }] },
    'k:gone': { title: 'c', currency: 'USD', firstSeen: '2026-10-01', series: [{ d: '2026-10-01', p: 100, s: 't' }] },
  })
  const log: OracleLog = { version: 1, entries: [entry('k:drop', .8), entry('k:flat', .2), entry('k:gone', .5), entry('k:drop', .9, '2026-10-30')] }
  it('resolves only predictions whose horizon has passed, and leaves unobservable ones out of the score', () => {
    const resolved = resolveLog(log, ledger, TODAY)
    expect(resolved.entries.map(e => e.outcome)).toEqual([1, 0, null, undefined])
    expect(resolveLog(log, ledger, '2026-10-15').entries.every(e => e.outcome === undefined)).toBe(true)
    const card = scorecard(resolved)
    expect(card).toMatchObject({ resolved: 2, brier: .04, baselineBrier: .25, since: '2026-10-01', firstDue: '2026-11-14' })
    expect(card.buckets.map(b => b.n)).toEqual([0, 1, 0, 0, 1])
    expect(card.buckets[4]!.hitRate).toBe(1)
    expect(card.buckets[1]!.hitRate).toBe(0)
  })
  it('keeps resolved outcomes on later runs and bounds the log by age', () => {
    const once = resolveLog(log, ledger, TODAY), twice = resolveLog(once, ledgerOf({}), '2026-11-20')
    expect(twice.entries.slice(0, 3).map(e => e.outcome)).toEqual([1, 0, null])
    const old = appendLog({ version: 1, entries: [entry('k:old', .1, '2026-01-01')] }, [], TODAY, .5)
    expect(old.entries).toHaveLength(0)
  })
})

describe('highlights', () => {
  const ledger = ledgerOf(Object.fromEntries([1, 2, 3, 4].map(i => ['asin:B00000000' + i, { title: 'Lenovo laptop ' + i, currency: 'USD', firstSeen: '2026-10-01', series: [{ d: '2026-11-01', p: 120, s: 't' }, { d: '2026-11-02', p: 100, s: 't' }, { d: '2026-11-03', p: 110, s: 't' }] }])))
  const drops = [1, 2, 3].map(i => deal({ id: 'drop' + i, title: 'Lenovo laptop ' + i, productKey: 'asin:B00000000' + i, price: 100 - i * 5, listPrice: null, discountPct: null, category: 'informatica' }))
  it('ranks observed drops from the ledger and states each rule in both languages', () => {
    expect(dropVsLast(drops[2]!, ledger, TODAY)).toBeCloseTo(22.7, 1)
    const file = buildHighlights(drops, ledger, now)
    const caidas = file.slots.find(s => s.id === 'caidas')!
    expect(caidas.dealIds).toEqual(['drop3', 'drop2', 'drop1'])
    expect(caidas.noteEn).toMatch(/last price we recorded/)
    // All three are also at or below every earlier day of a series that moved.
    expect(file.slots.find(s => s.id === 'minimo-historico')!.dealIds).toHaveLength(3)
    for (const slot of file.slots) for (const id of slot.dealIds) expect(drops.map(d => d.id)).toContain(id)
  })
  it('omits a slot with fewer than 3 deals instead of padding it', () => {
    expect(buildHighlights(drops.slice(0, 2), ledger, now).slots).toEqual([])
    expect(buildHighlights(drops, undefined, now).slots).toEqual([])
  })
  it('keeps games to one slot and needs observed evidence under 25 USD', () => {
    const games = [...Array(15)].map((_, i) => deal({ id: 'g' + i, title: 'Game ' + i, category: 'videojuegos', price: 2, listPrice: 40, discountPct: 95 }))
    const cheapList = [1, 2, 3].map(i => deal({ id: 'c' + i, price: 10, listPrice: 50, discountPct: 80, reference: { price: 50, kind: 'list', note: 'lista' }, referenceDiscountPct: 80 }))
    const cheapSeen = [1, 2, 3].map(i => deal({ id: 's' + i, price: 10, reference: { price: 20, kind: 'ledger', note: 'mediana', observations: 3 }, referenceDiscountPct: 50 }))
    const file = buildHighlights([...games, ...cheapList, ...cheapSeen], undefined, now)
    expect(file.slots.filter(s => s.id === 'juegos').map(s => s.dealIds.length)).toEqual([12])
    expect(file.slots.find(s => s.id === 'menos-de-25')!.dealIds).toEqual(['s1', 's2', 's3'])
  })
  it('finds AI hardware but not its accessories', () => {
    const hw = ['NVIDIA GeForce RTX 5090 graphics card', 'Minisforum mini PC Ryzen AI Max+ 395', 'Apple Mac Studio M4 Max'].map((title, i) => deal({ id: 'h' + i, title, discountPct: 20 }))
    const acc = deal({ id: 'acc', title: 'Cooling stand for mini PC', discountPct: 60 })
    expect(buildHighlights([...hw, acc], undefined, now).slots.find(s => s.id === 'hardware-ia')!.dealIds.sort()).toEqual(['h0', 'h1', 'h2'])
  })
})

describe('errors context', () => {
  // A candidate under today's rules too: branded RTX laptop at 8 % of a 1199 list price.
  const cand = (id: string, extra: Partial<Deal> = {}) => deal({ id, title: 'Lenovo laptop RTX 4060', price: 99, listPrice: 1199, discountPct: 91.74, category: 'informatica', errorScore: 55, ...extra })
  it('drops archived candidates that today\'s rules no longer call candidates, and republishes the current score', () => {
    const pajamas = deal({ id: 'pj', title: "Men's Plaid Pajama Pants for 2 for $10", price: 10, listPrice: 80, discountPct: 87.5, category: 'ropa', errorScore: 40 })
    const recent = recentCandidates([{ date: '2026-10-21', deals: [pajamas, cand('lap', { errorScore: 41 })] }], TODAY)
    expect(recent.map(r => r.deal.id)).toEqual(['lap'])
    expect(recent[0]!.deal.errorScore).toBe(100)
  })
  it('lists past candidates newest first, one per product, inside 30 days and never today or games', () => {
    const archives = [
      { date: '2026-10-21', deals: [cand('a', { url: 'https://www.amazon.com/dp/B000000AAA' }), cand('low', { errorScore: 39 })] },
      { date: '2026-10-27', deals: [cand('a2', { url: 'https://www.amazon.com/dp/B000000AAA' }), cand('game', { title: 'Space Game Deluxe Edition', category: 'videojuegos', store: 'Steam' })] },
      { date: '2026-09-01', deals: [cand('old')] },
      { date: TODAY, deals: [cand('today')] },
      { date: '2026-10-31', deals: [cand('dup-of-today', { productKey: 'k:now' })] },
    ]
    const recent = recentCandidates(archives as any, TODAY, [deal({ id: 'now', productKey: 'k:now' })])
    expect(recent.map(r => [r.date, r.deal.id])).toEqual([['2026-10-27', 'a2']])
  })
  it('picks the five closest non-game scores below 40', () => {
    const deals = [45, 39, 38, 30, 25, 20, 10, 0].map(s => deal({ id: 's' + s, errorScore: s }))
    expect(nearestMisses([...deals, deal({ id: 'g', errorScore: 15, category: 'videojuegos' })]).map(d => d.errorScore)).toEqual([39, 38, 30, 25, 20])
  })
})

describe('large observed moves', () => {
  const laptop = deal({ title: 'Lenovo Legion laptop RTX 4070', price: 480, listPrice: null, discountPct: null, category: 'informatica', reference: { price: 1000, kind: 'ledger', observations: 4, note: 'Mediana de 4 días observados (sin hoy)' }, referenceDiscountPct: 52 })
  it('scores a stable price that breaks through its own floor, by depth', () => {
    const stable = scoreError(laptop, 0, { days: 4, minPrice: 1000, maxPrice: 1050, firstSeen: '2026-10-01' })
    expect(stable.errorScore).toBe(50)
    expect(stable.errorSignals.join(' ')).toMatch(/Rompe un precio estable: 52 %/)
    expect(scoreError({ ...laptop, price: 650 }, 0, { days: 4, minPrice: 1000, maxPrice: 1050, firstSeen: '2026-10-01' }).errorScore).toBe(35)
  })
  it('ignores it when the price was already moving or seen too few days', () => {
    expect(scoreError(laptop, 0, { days: 4, minPrice: 1000, maxPrice: 1500, firstSeen: '2026-10-01' }).errorScore).toBe(20)
    expect(scoreError(laptop, 0, { days: 2, minPrice: 1000, maxPrice: 1000, firstSeen: '2026-10-01' }).errorScore).toBe(20)
  })
  it('gives interest to a new low against our own ledger', () => {
    const d = deal({ price: 90, history: { days: 3, minPrice: 100, maxPrice: 120, firstSeen: '2026-10-01' } })
    expect(interestOf(d).interestSignals).toContain('Nuevo mínimo frente a 3 días observados')
    expect(interestOf({ ...d, price: 97 }).interestSignals?.join(' ')).not.toMatch(/Nuevo mínimo/)
  })
})

describe('outputs', () => {
  it('writes errors context, highlights, oracle, a bilingual sitemap and the English llms section', async () => {
    const root = await mkdtemp(join(tmpdir(), 'barato-oracle-'))
    try {
      await mkdir(join(root, 'api/deals'), { recursive: true })
      await writeFile(join(root, 'api/deals/2026-10-27.json'), JSON.stringify({ date: '2026-10-27', deals: [deal({ id: 'past', title: 'Lenovo laptop RTX 4060', price: 99, listPrice: 1199, discountPct: 91.74, category: 'informatica', errorScore: 55 })] }))
      await writeFile(join(root, 'api/deals/2026-10-28.json'), 'not json')
      const near = deal({ id: 'near', errorScore: 30 })
      const file = { version: 3 as const, date: TODAY, generatedAt: now.toISOString(), count: 1, sources: [], deals: [near] }
      retainCollected(file, [near])
      const highlights = { version: 1 as const, date: TODAY, generatedAt: now.toISOString(), slots: [] }
      const oracle = buildOracle([], ledgerOf({}), emptyOracleLog(), now).file
      await writeOutputs(root, file, { highlights, oracle })
      const errors = JSON.parse(await readFile(join(root, 'api/errors.json'), 'utf8'))
      expect(errors.deals).toEqual([])
      expect(errors.recent.map((r: any) => [r.date, r.deal.id])).toEqual([['2026-10-27', 'past']])
      expect(errors.nearest.map((d: any) => d.id)).toEqual(['near'])
      expect(JSON.parse(await readFile(join(root, 'api/highlights.json'), 'utf8'))).toEqual(highlights)
      expect(JSON.parse(await readFile(join(root, 'api/oracle.json'), 'utf8')).predictions).toEqual([])
      const map = await readFile(join(root, 'sitemap.xml'), 'utf8')
      expect(map).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
      for (const loc of ['en/', 'en/errores/', 'en/archivo/', 'en/api/', 'si/', 'en/si/', 'privacidad/', 'en/privacy/']) expect(map).toContain(`<loc>https://barato.si/${loc}</loc>`)
      expect(map).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://barato.si/en/si/"/>')
      expect(map).toContain('https://barato.si/errors.xml')
      const llms = await readFile(join(root, 'llms.txt'), 'utf8')
      for (const text of ['## English', 'api/oracle.json', 'api/highlights.json', 'Formship LLC', 'https://formship.io']) expect(llms).toContain(text)
    } finally { await rm(root, { recursive: true }) }
  })
  it('keeps the sitemap well formed: every url has es, en and x-default alternates', () => {
    const map = sitemap(now.toISOString())
    expect(map.match(/<url>/g)).toHaveLength(24)
    expect(map.match(/hreflang="x-default"/g)).toHaveLength(18)
  })
})
