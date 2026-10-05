import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { collect, rss, writeOutputs, readPrevious } from '../scripts/pipeline'
import { createSourceReader } from '../scripts/network'
import { sources } from '../scripts/sources'
import { robotsAllowed, USER_AGENT } from '../lib/robots'
import { deal, now } from './helpers'

it('runs fixtures through collection, recording every source outcome', async () => {
  const probes = JSON.parse(await readFile(new URL('./fixtures/live-probes.json', import.meta.url), 'utf8')).results
  const file = await collect(sources, async s => {
    if (s.disabled) throw new Error(s.disabled)
    const key = s.name.startsWith('reddit-') ? 'reddit' : s.name
    if (!robotsAllowed(probes[`${key}-robots`].body, s.url)) throw new Error('Blocked by robots.txt')
    return readFile(new URL('./fixtures/dealnews.xml', import.meta.url), 'utf8')
  }, now)
  expect(file.sources).toHaveLength(sources.length)
  expect(file.sources.filter(s => s.ok).map(s => s.name)).toEqual(['dealnews'])
  expect(file.count).toBeGreaterThan(0)
  expect(file.count).toBe(file.deals.length)
})

it('fails soft even when every source is down', async () => {
  const file = await collect(sources, async () => { throw new Error('offline') }, now)
  expect(file.count).toBe(0)
  expect(file.sources.every(s => !s.ok && s.error === 'offline')).toBe(true)
})

it('preserves first-seen dates when an offer disappears for a day', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-history-'))
  try {
    await mkdir(join(root, 'api/deals'), { recursive: true })
    await writeFile(join(root, 'api/deals.json'), JSON.stringify({ deals: [] }))
    const old = deal({ foundAt: '2026-10-03T00:00:00Z' })
    await writeFile(join(root, 'api/deals/2026-10-03.json'), JSON.stringify({ deals: [old] }))
    expect(await readPrevious(root)).toEqual([old])
  } finally { await rm(root, { recursive: true }) }
})

it('caps the ranked output at 150', async () => {
  const raw = '<rss><channel>' + Array.from({ length: 175 }, (_, n) => `<item><title>Unique product model ${n} $5</title><link>https://shop.test/${n}</link></item>`).join('') + '</channel></rss>'
  const file = await collect([{ name: 'test', kind: 'rss', url: 'https://test/rss' }], async () => raw, now)
  expect(file.count).toBe(150)
  expect(file.sources[0]?.count).toBe(175)
})

it('writes exact API paths, escapes RSS, and keeps a 30 UTC day window', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-test-'))
  try {
    await mkdir(join(root, 'api/deals'), { recursive: true })
    for (const name of ['2026-09-05.json', '2026-09-06.json', 'keep.txt']) await writeFile(join(root, 'api/deals', name), '{}')
    const file = { date: '2026-10-05', generatedAt: now.toISOString(), count: 35, sources: [], deals: Array.from({ length: 35 }, (_, i) => deal({ id: String(i), title: 'A&B <deal>', url: `https://shop.test/${i}?a=1&b=2` })) }
    await writeOutputs(root, file)
    expect(await readdir(join(root, 'api/deals'))).toEqual(['2026-09-06.json', '2026-10-05.json', 'keep.txt'])
    expect(JSON.parse(await readFile(join(root, 'api/index.json'), 'utf8'))).toEqual({ latest: file.date, days: ['2026-10-05', '2026-09-06'] })
    expect(await readFile(join(root, 'api/deals.json'), 'utf8')).toBe(await readFile(join(root, 'api/deals/2026-10-05.json'), 'utf8'))
    expect(rss(file).match(/<item>/g)).toHaveLength(30)
    expect(rss(file)).toContain('A&amp;B &lt;deal&gt;')
    expect(await readFile(join(root, 'robots.txt'), 'utf8')).toContain('Sitemap: https://barato.si/sitemap.xml')
  } finally { await rm(root, { recursive: true }) }
})

it('checks robots once per origin, never fetches disallowed content, and sends honest UA', async () => {
  const mock = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
    expect((options?.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT)
    expect(options?.redirect).toBe('manual')
    return new Response('User-agent: *\nDisallow: /', { status: 200 })
  })
  const read = createSourceReader(mock as typeof fetch)
  await expect(read(sources[0]!)).rejects.toThrow('Blocked by robots')
  await expect(read(sources[0]!)).rejects.toThrow('Blocked by robots')
  expect(mock).toHaveBeenCalledTimes(1)
})

it.each([403, 429, 500, 301])('fails soft for HTTP %s without retrying or following redirects', async status => {
  const mock = vi.fn().mockResolvedValueOnce(new Response('User-agent: *\nAllow: /')).mockResolvedValueOnce(new Response('', { status }))
  await expect(createSourceReader(mock)(sources[3]!)).rejects.toThrow()
  expect(mock).toHaveBeenCalledTimes(2)
})

it('fails closed on unavailable robots and makes no request for disabled sources', async () => {
  const mock = vi.fn().mockRejectedValue(new Error('timeout'))
  const read = createSourceReader(mock)
  await expect(read(sources[3]!)).rejects.toThrow('timeout')
  await expect(read(sources[1]!)).rejects.toThrow('Permission required')
  expect(mock).toHaveBeenCalledTimes(1)
})
