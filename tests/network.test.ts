import { expect, it, vi } from 'vitest'
import { createSourceReader, ownerApproved } from '../scripts/network'
import { configuredSources } from '../scripts/sources'
import { USER_AGENT } from '../lib/robots'
import type { Source } from '../lib/normalize'

it('pins exactly five public API exceptions by kind, origin and path', () => {
  const sources = configuredSources({})
  const approved = sources.flatMap(s => (s.pages || [{ url: s.url }]).map(p => ({ ...s, ...p }))).filter(ownerApproved)
  expect(new Set(approved.map(s => new URL(s.url).origin + new URL(s.url).pathname)).size).toBe(5)
  for (const s of approved) {
    expect(ownerApproved({ ...s, url: s.url.replace('https:', 'http:') })).toBe(false)
    const u = new URL(s.url); u.pathname += 'not-approved'
    expect(ownerApproved({ ...s, url: u.href })).toBe(false)
  }
})
it('serializes a host, honors crawl delay, and limits total concurrency to six', async () => {
  vi.useFakeTimers()
  try {
    let active = 0, maximum = 0
    const activeHosts = new Set<string>()
    const started: number[] = []
    const mock = vi.fn(async (url: string, init: RequestInit) => {
      expect((init.headers as any)['User-Agent']).toBe(USER_AGENT)
      const u = new URL(url)
      expect(activeHosts.has(u.host)).toBe(false)
      activeHosts.add(u.host); active++; maximum = Math.max(maximum, active)
      if (u.host === 'publisher.test' && u.pathname !== '/robots.txt') started.push(Date.now())
      await new Promise(resolve => setTimeout(resolve, 50))
      activeHosts.delete(u.host); active--
      return new Response(u.pathname === '/robots.txt' ? 'User-agent: *\nAllow: /\nCrawl-delay: 2' : '{}')
    })
    const read = createSourceReader(mock as typeof fetch)
    const calls = [...Array.from({ length: 9 }, (_, i) => read({ name: 'Publisher', kind: 'rss', url: `https://host${i}.test/feed` })), ...[1, 2, 3].map(i => read({ name: 'Publisher', kind: 'rss', url: `https://publisher.test/feed${i}` }))]
    const pending = Promise.all(calls)
    await vi.advanceTimersByTimeAsync(12000)
    await pending
    expect(maximum).toBeLessThanOrEqual(6)
    expect(started).toHaveLength(3)
    expect(started[1]! - started[0]!).toBeGreaterThanOrEqual(2000)
    expect(started[2]! - started[1]!).toBeGreaterThanOrEqual(2000)
    expect(mock.mock.calls.filter(([url]) => url === 'https://publisher.test/robots.txt')).toHaveLength(1)
  } finally { vi.useRealTimers() }
})
it('retries first-party JSON once on 5xx, but never publisher feeds', async () => {
  vi.useFakeTimers()
  try {
    const mock = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response('{}'))
    const count = vi.fn()
    const pending = createSourceReader(mock)(configuredSources({})[1]!, { onRequest: count })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toBe('{}')
    expect(mock).toHaveBeenCalledTimes(2)
    expect(count).toHaveBeenCalledTimes(2)
    const rss = vi.fn().mockResolvedValueOnce(new Response('User-agent: *\nAllow: /')).mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(createSourceReader(rss)({ name: 'Publisher', kind: 'rss', url: 'https://publisher.test/rss' })).rejects.toThrow('HTTP 503')
    expect(rss).toHaveBeenCalledTimes(2)
  } finally { vi.useRealTimers() }
})
it('times out requests at 20 seconds and retries only once', async () => {
  vi.useFakeTimers()
  try {
    const mock = vi.fn(() => new Promise<Response>(() => {}))
    const read = createSourceReader(mock)
    const pending = read(configuredSources({})[1]!).catch(e => e.message)
    await vi.advanceTimersByTimeAsync(41000)
    expect(await pending).toBe('Request timeout')
    expect(mock).toHaveBeenCalledTimes(2)
  } finally { vi.useRealTimers() }
})
it('rejects oversized bodies, including streams without content-length', async () => {
  for (const response of [new Response('small', { headers: { 'content-length': '4000001' } }), new Response('x'.repeat(4000001))]) {
    await expect(createSourceReader(vi.fn(async () => response))(configuredSources({})[0]!)).rejects.toThrow('4 MB')
  }
})
it('adds Best Buy query credentials only at transport and never exposes error details', async () => {
  const s = configuredSources({ BESTBUY_API_KEY: 'secret-key' }).find(s => s.kind === 'bestbuy')!
  expect(s.url).not.toContain('secret-key')
  const mock = vi.fn(async (url: string) => {
    if (url.endsWith('/robots.txt')) return new Response('', { status: 404 })
    expect(new URL(url).searchParams.get('apiKey')).toBe('secret-key')
    throw new Error('Failed URL ' + url)
  })
  await expect(createSourceReader(mock as typeof fetch)(s)).rejects.toThrow('No se pudo consultar la API protegida.')
  expect(mock).toHaveBeenCalledTimes(2)
})
it('keeps Woot dormant without a key and sends a configured key only on its feed request', async () => {
  expect(configuredSources({}).some(s => ['woot', 'bestbuy', 'itad'].includes(s.kind))).toBe(false)
  const s = configuredSources({ WOOT_API_KEY: 'woot-secret' }).find(s => s.kind === 'woot')!
  const mock = vi.fn(async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>
    if (url.endsWith('/robots.txt')) { expect(headers['x-api-key']).toBeUndefined(); return new Response('', { status: 404 }) }
    expect(url).toBe('https://developer.woot.com/feed/All?page=1')
    expect(headers['x-api-key']).toBe('woot-secret')
    return new Response('{"Items":[]}')
  })
  await createSourceReader(mock as typeof fetch)(s)
})
it('aborts queued requests without contacting their endpoint', async () => {
  const controller = new AbortController()
  controller.abort()
  const mock = vi.fn()
  await expect(createSourceReader(mock)(configuredSources({})[0]!, { signal: controller.signal })).rejects.toThrow()
  expect(mock).not.toHaveBeenCalled()
})
