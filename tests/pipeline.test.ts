import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { collect, rss, writeOutputs, readPrevious, balanceRanking } from '../scripts/pipeline'
import { createSourceReader } from '../scripts/network'
import { configuredSources, sources } from '../scripts/sources'
import { robotsAllowed, USER_AGENT } from '../lib/robots'
import { deal, now } from './helpers'

it('runs fixtures through collection, recording every source outcome', async () => {
  const file = await collect(sources, async s => {
    if (s.kind === 'cheapshark') return JSON.stringify([{ title: 'Synthetic game', dealID: 'fixture', storeID: '7', isOnSale: '1', salePrice: '1', normalPrice: '50' }])
    return readFile(new URL('./fixtures/' + (s.kind === 'rss' ? (s.name === 'Techbargains' ? 'techbargains.xml' : 'dealnews.xml') : s.kind + '.json'), import.meta.url), 'utf8')
  }, now)
  expect(file.sources).toHaveLength(sources.length)
  expect(file.sources.filter(s => s.ok).map(s => s.name)).toEqual(['CheapShark', 'Steam', 'Epic', 'DealNews', 'GOG', 'Techbargains'])
  expect(file.count).toBeGreaterThan(0)
  expect(file.count).toBe(file.deals.length)
  expect(file.sources.filter(s => !s.ok).every(s => s.error && s.errorEs)).toBe(true)
  expect(file.sources.find(s => s.ok)?.errorEs).toBeUndefined()
})

it('fails soft even when every source is down', async () => {
  const file = await collect(sources, async () => { throw new Error('offline') }, now)
  expect(file.count).toBe(0)
  expect(file.sources.every(s => !s.ok && !!s.errorEs)).toBe(true)
  expect(file.sources.every(s => s.errorEs)).toBe(true)
})

it.each([
  ['Blocked by robots.txt; endpoint was not requested', 'La fuente no permite la consulta automática.'],
  ['robots.txt unavailable or invalid (HTTP 403)', 'No se pudo comprobar el permiso de consulta.'],
  ['Redirect refused (HTTP 301)', 'La fuente redirige a otra dirección; pendiente de revisión.'],
  ['Invalid or unsafe syndication XML', 'La fuente devolvió datos que no se pudieron interpretar.'],
  ['HTTP 503', 'No se pudieron obtener las ofertas de esta fuente.'],
  ['timeout', 'No se pudieron obtener las ofertas de esta fuente.'],
])('supplies safe Spanish visitor text: %s', async (error, errorEs) => {
  const file = await collect([sources[3]!], async () => { throw new Error(error) }, now)
  expect(file.sources[0]).toMatchObject({ name: 'DealNews', ok: false, count: 0, error, errorEs, requests: 1, direct: false })
})

it('round-trips Spanish accents as UTF-8 in JSON, archives, RSS and discovery text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-utf8-'))
  try {
    const file = await collect([{ ...sources[1]!, disabled: 'Paused' }], async () => { throw new Error('Paused') }, now)
    file.deals = [deal({ title: 'Café y té', reasons: ['Ahorro de 42,54 USD'] })]
    file.count = 1
    await writeOutputs(root, file)
    for (const name of ['api/deals.json', `api/deals/${file.date}.json`]) {
      const bytes = await readFile(join(root, name))
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      expect(JSON.parse(text)).toEqual(file)
      expect(text).toContain('Fuente desactivada; pendiente de revisión.')
      expect(text).toContain('Café y té')
    }
    expect(await readFile(join(root, 'feed.xml'), 'utf8')).toContain('Café y té')
    expect(await readFile(join(root, 'llms.txt'), 'utf8')).toContain('últimos 30 días UTC')
  } finally { await rm(root, { recursive: true }) }
})

it('preserves first-seen dates when an offer disappears for a day', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-history-'))
  try {
    await mkdir(join(root, 'api/deals'), { recursive: true })
    await writeFile(join(root, 'api/deals.json'), JSON.stringify({ deals: [] }))
    const old = deal({ foundAt: '2026-10-03T00:00:00Z' })
    await writeFile(join(root, 'api/deals/2026-10-03.json'), JSON.stringify({ deals: [old] }))
    expect(await readPrevious(root, now)).toMatchObject([{ ...old, history: { days: 1, minPrice: old.price, maxPrice: old.price, firstSeen: old.foundAt } }])
  } finally { await rm(root, { recursive: true }) }
})

it('caps the ranked output at 400', async () => {
  const raw = '<rss><channel>' + Array.from({ length: 425 }, (_, n) => `<item><title>Unique product model ${n} $5</title><link>https://shop.test/${n}</link></item>`).join('') + '</channel></rss>'
  const file = await collect([{ name: 'test', kind: 'rss', url: 'https://test/rss' }], async () => raw, now)
  expect(file.count).toBe(400)
  expect(file.sources[0]?.count).toBe(425)
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
  await expect(read({ ...sources[0]!, url: 'https://www.cheapshark.com/not-approved' })).rejects.toThrow('Blocked by robots')
  await expect(read({ ...sources[0]!, url: 'https://www.cheapshark.com/not-approved' })).rejects.toThrow('Blocked by robots')
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
  await expect(read(sources[3]!)).rejects.toThrow('No se pudo consultar la fuente.')
  await expect(read({ ...sources[1]!, disabled: 'Permission required' })).rejects.toThrow('Permission required')
  expect(mock).toHaveBeenCalledTimes(1)
})

it('publishes only product sources, with ITAD opt-in and no leaked key', async () => {
  expect(configuredSources({}).map(s => s.name)).toEqual(['CheapShark', 'Steam', 'Epic', 'DealNews', 'GOG', 'Techbargains'])
  const configured = configuredSources({ ITAD_API_KEY: 'test-secret' })
  expect(configured.at(-1)?.kind).toBe('itad')
  const file = await collect(configured, async () => { throw new Error('HTTP 403') }, now)
  expect(JSON.stringify(file)).not.toContain('test-secret')
})
it.each([0, 1, 2])('uses exactly one approved endpoint request with the honest UA (%s)', async index => {
  const mock = vi.fn(async (_url, options) => {
    expect(options.headers['User-Agent']).toBe(USER_AGENT)
    return new Response('{}')
  })
  await createSourceReader(mock)(sources[index]!)
  expect(mock).toHaveBeenCalledTimes(1)
  expect(mock.mock.calls[0]?.[0]).toBe(sources[index]!.url)
})
it('sends ITAD credentials only to the data endpoint as a header', async () => {
  const mock = vi.fn().mockResolvedValueOnce(new Response('User-agent: *\nAllow: /')).mockResolvedValueOnce(new Response('{"list":[]}'))
  await createSourceReader(mock)(configuredSources({ ITAD_API_KEY: 'secret' }).at(-1)!)
  expect(mock.mock.calls[0]?.[1].headers['ITAD-API-Key']).toBeUndefined()
  expect(mock.mock.calls[1]?.[1].headers['ITAD-API-Key']).toBe('secret')
})
it('balances games across sources against other offers without losing or duplicating entries', () => {
  const games = Array.from({ length: 60 }, (_, i) => deal({ id: `g${i}`, category: 'videojuegos', source: i % 2 ? 'Steam' : 'CheapShark', score: 100 - i }))
  const other = Array.from({ length: 40 }, (_, i) => deal({ id: `o${i}`, score: 50 - i }))
  const result = balanceRanking([...games, ...other])
  // Three other offers, then one game, all the way down; games fill in once the other pool is spent.
  expect(result.slice(0, 32).filter(d => d.category === 'videojuegos')).toHaveLength(8)
  expect(result.slice(0, 3).every(d => !d.category)).toBe(true)
  expect(result[3]?.category).toBe('videojuegos')
  expect(new Set(result.map(d => d.id)).size).toBe(100)
  expect(result.slice(0, 54).filter(d => !d.category)).toHaveLength(40)
  expect(balanceRanking(games)).toEqual(games)
})
it('does not generate Spain-only wording in RSS or discovery text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'barato-wording-'))
  try {
    await writeOutputs(root, { date: '2026-10-05', generatedAt: now.toISOString(), count: 0, sources: [], deals: [] })
    for (const name of ['feed.xml', 'llms.txt']) expect(await readFile(join(root, name), 'utf8')).not.toMatch(/chollo/i)
  } finally { await rm(root, { recursive: true }) }
})
