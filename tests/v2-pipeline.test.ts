import { it, expect, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collect, readPrevious, writeOutputs } from '../scripts/pipeline'
import { retainCollected } from '../scripts/outputs'
import { deal, now } from './helpers'
import type { Source } from '../lib/normalize'

const source = (name: string): Source => ({ name, kind: 'rss', url: `https://${name}.test/rss` })
const raw = '<rss><channel><item><title>Laptop $99 (was $1199)</title><link>https://shop.test/laptop</link></item></channel></rss>'
it('isolates slow and throwing sources, returns completed pages and records source deadlines', async () => {
  vi.useFakeTimers()
  try {
    const read = vi.fn(async (s: Source) => {
      if (s.name === 'slow') return new Promise<string>(() => {})
      if (s.name === 'throwing') throw new Error('secret diagnostic')
      return raw
    })
    const pending = collect([source('slow'), source('throwing'), source('fast')], read, now)
    await vi.advanceTimersByTimeAsync(45001)
    const file = await pending
    expect(read).toHaveBeenCalledTimes(3)
    expect(file.deals).toHaveLength(1)
    expect(file.sources[0]).toMatchObject({ ok: false, ms: 45000, requests: 1, count: 0, errorEs: 'Se agotó el tiempo disponible para esta fuente.' })
    // Unkeyed sources publish their English diagnostic (operators need the HTTP status); Spanish text stays generic.
    expect(file.sources[1]).toMatchObject({ ok: false, error: 'secret diagnostic', errorEs: 'No se pudieron obtener las ofertas de esta fuente.' })
    expect(file.sources[2]).toMatchObject({ ok: true, count: 1, requests: 1 })
    expect(vi.getTimerCount()).toBe(0)
  } finally { vi.useRealTimers() }
})
it('honors the whole-run budget and prevents late work from mutating a published result', async () => {
  vi.useFakeTimers()
  try {
    let finish!: (text: string) => void
    const pending = collect([source('slow'), source('fast')], s => s.name === 'slow' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(raw), now, [], { runTimeout: 1000 })
    await vi.advanceTimersByTimeAsync(1001)
    const file = await pending, snapshot = JSON.stringify(file)
    expect(file.sources[0]).toMatchObject({ ok: false, ms: 1000 })
    finish(raw)
    await vi.advanceTimersByTimeAsync(1)
    expect(JSON.stringify(file)).toBe(snapshot)
    expect(vi.getTimerCount()).toBe(0)
  } finally { vi.useRealTimers() }
})
it('retains only fully normalized pages when a later page fails', async () => {
  const s = { ...source('paged'), pages: [{ url: 'https://paged.test/1' }, { url: 'https://paged.test/2' }] }
  const file = await collect([s], async p => p.url.endsWith('1') ? raw : '<html>broken</html>', now)
  expect(file.count).toBe(1)
  expect(file.sources[0]).toMatchObject({ ok: false, count: 1, requests: 2 })
})
it('discards a protected source response that echoes its credential', async () => {
  const secret = 'never-publish-this-key'
  const file = await collect([{ ...source('protected'), apiKey: secret }], async () => raw.replace('Laptop', secret), now)
  expect(file.count).toBe(0)
  expect(file.sources[0]?.ok).toBe(false)
  expect(JSON.stringify(file)).not.toContain(secret)
})
it('migrates v1 archives, counts unique prior UTC days and excludes today', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-v2-history-'))
  try {
    await mkdir(join(root, 'api/deals'), { recursive: true })
    const { errorScore, errorSignals, storeUrl, storeDomain, ...old } = deal({ price: 99, foundAt: '2026-10-01T00:00:00Z' })
    for (const day of ['2026-10-03', '2026-10-04', '2026-10-05']) await writeFile(join(root, `api/deals/${day}.json`), JSON.stringify({ date: day, deals: [old] }))
    await writeFile(join(root, 'api/deals.json'), JSON.stringify({ date: '2026-10-04', deals: [old] }))
    const previous = await readPrevious(root, now)
    expect(previous).toHaveLength(1)
    expect(previous[0]).toMatchObject({ errorScore: 0, errorSignals: [], storeUrl: null, storeDomain: null, history: { days: 2, minPrice: 99, maxPrice: 99, firstSeen: old.foundAt } })
  } finally { await rm(root, { recursive: true }) }
})
it('writes all error candidates independently of the 400 cap, moves raw syndication and prunes both archives', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-v2-output-'))
  try {
    for (const dir of ['deals', 'raw']) {
      await mkdir(join(root, 'api', dir), { recursive: true })
      await writeFile(join(root, 'api', dir, '2026-09-01.json'), '{}')
    }
    const d = deal({ errorScore: 50, errorSignals: ['Evidencia comprobable'], syndication: { attribution: 'DealNews', feedUrl: 'https://www.dealnews.com/?rss=1', itemXml: '<item><title>Original</title></item>', descriptionHtml: '<p>Original</p>' } })
    const extra = deal({ id: 'outside-main', errorScore: 95, errorSignals: ['Precio anómalo'] })
    const file = { version: 2 as const, date: '2026-10-05', generatedAt: now.toISOString(), count: 1, sources: [], deals: [d] }
    retainCollected(file, [d, extra])
    await writeOutputs(root, file)
    const published = JSON.parse(await readFile(join(root, 'api/deals.json'), 'utf8'))
    expect(published.deals[0].syndication).not.toHaveProperty('itemXml')
    expect(published.deals[0].syndication).not.toHaveProperty('descriptionHtml')
    expect(d.syndication?.itemXml).toBeTruthy()
    expect(JSON.parse(await readFile(join(root, 'api/errors.json'), 'utf8')).deals.map((v: any) => v.id)).toEqual(['outside-main', 'a'])
    expect(await readFile(join(root, 'errors.xml'), 'utf8')).toContain('Precio anómalo')
    expect(await readFile(join(root, 'feed.xml'), 'utf8')).toContain('<title>Original</title>')
    expect(JSON.parse(await readFile(join(root, 'api/raw/2026-10-05.json'), 'utf8')).a).toEqual({ itemXml: d.syndication!.itemXml, descriptionHtml: '<p>Original</p>' })
    for (const dir of ['deals', 'raw']) expect(await readdir(join(root, 'api', dir))).toEqual(['2026-10-05.json'])
    for (const path of ['llms.txt', 'sitemap.xml']) expect(await readFile(join(root, path), 'utf8')).toContain('https://barato.si/errors.xml')
  } finally { await rm(root, { recursive: true }) }
})
it('rejects oversized output before replacing current data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-v2-size-'))
  try {
    await mkdir(join(root, 'api'))
    await writeFile(join(root, 'api/deals.json'), 'previous')
    await expect(writeOutputs(root, { date: '2026-10-05', generatedAt: now.toISOString(), count: 1, sources: [], deals: [deal({ sourceText: 'x'.repeat(700000) })] })).rejects.toThrow('tamaño')
    expect(await readFile(join(root, 'api/deals.json'), 'utf8')).toBe('previous')
  } finally { await rm(root, { recursive: true }) }
})

it('carries a blocked source over from a recent published file, visibly, and never past the window', async () => {
  const kept = [deal({ id: 'tb1', source: 'Techbargains', title: 'Laptop for $499 (was $1,099)', price: 499, listPrice: 1099 }), deal({ id: 'tb2', source: 'Techbargains', url: 'https://shop.test/2' })]
  const stranger = deal({ id: 'dn1', source: 'DealNews' })
  const src = { name: 'Techbargains', kind: 'rss' as const, url: 'https://www.techbargains.com/rss.xml' }
  const blocked = async () => { throw new Error('robots.txt unavailable') }
  const recent = { generatedAt: new Date(now.getTime() - 3600000).toISOString(), sources: [{ name: 'Techbargains', ok: true, count: 2 }], deals: [...kept, stranger] }
  const file = await collect([src], blocked, now, [], { latest: recent })
  expect(file.sources[0]).toMatchObject({ name: 'Techbargains', ok: true, count: 2, reusedFrom: recent.generatedAt, error: 'robots.txt unavailable' })
  expect(file.sources[0]!.errorEs).toContain('reutilizadas')
  expect(file.deals.map(d => d.id).sort()).toEqual(['tb1', 'tb2'])
  // The age is measured from the original fetch: a carried file cannot be carried again past 14 h.
  const chained = { ...recent, generatedAt: new Date(now.getTime() - 3600000).toISOString(), sources: [{ name: 'Techbargains', ok: true, count: 2, reusedFrom: new Date(now.getTime() - 15 * 3600000).toISOString() }] }
  expect((await collect([src], blocked, now, [], { latest: chained })).sources[0]).toMatchObject({ ok: false, count: 0 })
  const stale = { ...recent, generatedAt: new Date(now.getTime() - 15 * 3600000).toISOString() }
  expect((await collect([src], blocked, now, [], { latest: stale })).sources[0]).toMatchObject({ ok: false, count: 0 })
})
