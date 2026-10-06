import { USER_AGENT, robotsAllowed } from '../lib/robots.ts'
import { bounded, pause } from '../lib/budget.ts'
import type { Source } from '../lib/normalize.ts'

export interface RequestContext { signal?: AbortSignal; onRequest?: () => void }
export function ownerApproved(source: Source): boolean {
  const u = new URL(source.url)
  return [
    ['cheapshark', 'https://www.cheapshark.com', '/api/1.0/deals'],
    ['steam', 'https://store.steampowered.com', '/api/featuredcategories'],
    ['steam-search', 'https://store.steampowered.com', '/search/results/'],
    ['gog', 'https://catalog.gog.com', '/v1/catalog'],
    ['epic', 'https://store-site-backend-static.ak.epicgames.com', '/freeGamesPromotions'],
  ].some(([kind, origin, path]) => source.kind === kind && u.origin === origin && u.pathname === path)
}

export function createSourceReader(fetcher: typeof fetch = fetch, timeout = 20000) {
  const robots = new Map<string, string>()
  const hosts = new Map<string, Promise<void>>()
  const lastRequest = new Map<string, number>()
  let active = 0
  const waiting: (() => void)[] = []
  async function acquire(signal: AbortSignal) {
    if (active < 6) { active++; return }
    let wake!: () => void
    const turn = new Promise<void>(resolve => { wake = resolve; waiting.push(wake) })
    try { await bounded(turn, signal) } catch (e) {
      const index = waiting.indexOf(wake)
      if (index >= 0) waiting.splice(index, 1)
      else release()
      throw e
    }
  }
  function release() { const next = waiting.shift(); if (next) next(); else active-- }
  async function request(url: string, signal: AbortSignal, headers: Record<string, string> = {}, onRequest?: () => void) {
    await acquire(signal)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const combined = AbortSignal.any([signal, controller.signal])
    try {
      combined.throwIfAborted()
      onRequest?.()
      return await bounded((async () => {
        const response = await fetcher(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/rss+xml, text/plain;q=0.9', ...headers }, redirect: 'manual', signal: combined })
        if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new Error('Redirect refused') }
        if (Number(response.headers.get('content-length')) > 4_000_000) { await response.body?.cancel(); throw new Error('Response exceeds 4 MB limit') }
        const chunks: Uint8Array[] = []
        let length = 0
        if (response.body) for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
          length += chunk.length
          if (length > 4_000_000) throw new Error('Response exceeds 4 MB limit')
          chunks.push(chunk)
        }
        return { status: response.status, body: Buffer.concat(chunks).toString('utf8') }
      })(), combined)
    } catch (e) {
      if (combined.aborted) throw new Error('Request timeout')
      throw e
    } finally { clearTimeout(timer); release() }
  }
  const reader = async (source: Source, context: RequestContext = {}): Promise<string> => {
    if (source.disabled) throw new Error(source.disabled)
    const signal = context.signal || new AbortController().signal
    const origin = new URL(source.url).origin
    const predecessor = hosts.get(origin) || Promise.resolve()
    let unlock!: () => void
    const gate = new Promise<void>(resolve => { unlock = resolve })
    const tail = predecessor.then(() => gate)
    hosts.set(origin, tail)
    try {
      await bounded(predecessor, signal)
      signal.throwIfAborted()
      let delay = source.name === 'DealNews' ? 2000 : 0
      if (!ownerApproved(source)) {
        if (!robots.has(origin)) {
          const r = await request(origin + '/robots.txt', signal)
          lastRequest.set(origin, Date.now())
          if ([404, 410].includes(r.status)) robots.set(origin, '')
          else if (r.status !== 200 || /<(?:html|!doctype)/i.test(r.body)) throw new Error('robots.txt unavailable')
          else robots.set(origin, r.body)
        }
        const policy = robots.get(origin)!
        if (!robotsAllowed(policy, source.url)) throw new Error('Blocked by robots.txt')
        delay = Math.max(delay, ...[...policy.matchAll(/^\s*crawl-delay:\s*([\d.]+)/gim)].map(m => Number(m[1]) * 1000))
        if (delay > 30000) throw new Error('Crawl-delay exceeds run budget')
      }
      const headers: Record<string, string> = {}
      const url = new URL(source.url)
      if (source.apiKey) {
        if (source.kind === 'bestbuy') url.searchParams.set('apiKey', source.apiKey)
        else headers[source.kind === 'woot' ? 'x-api-key' : 'ITAD-API-Key'] = source.apiKey
      }
      const retry = source.direct && source.kind !== 'rss'
      for (let attempt = 0; ; attempt++) {
        const wait = delay - (Date.now() - (lastRequest.get(origin) || 0))
        if (wait > 0) await pause(wait, signal)
        try {
          const r = await request(url.href, signal, headers, context.onRequest)
          lastRequest.set(origin, Date.now())
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
          return r.body
        } catch (e) {
          lastRequest.set(origin, Date.now())
          if (!retry || attempt || signal.aborted || !/HTTP 5\d\d|timeout/i.test(e instanceof Error ? e.message : '')) throw e
          await pause(250 + Math.random() * 500, signal)
        }
      }
    } catch (e) {
      // Transport exceptions may include query credentials. Never publish them.
      if (source.apiKey) throw new Error('No se pudo consultar la API protegida.')
      const message = e instanceof Error ? e.message : ''
      if (/^(HTTP \d{3}|Blocked by robots.txt|robots.txt unavailable|Redirect refused|Response exceeds 4 MB limit|Request timeout|Crawl-delay exceeds run budget)$/.test(message)) throw new Error(message)
      throw new Error('No se pudo consultar la fuente.')
    } finally {
      unlock()
      if (hosts.get(origin) === tail) void tail.then(() => { if (hosts.get(origin) === tail) hosts.delete(origin) })
    }
  }
  return Object.assign(reader, { tracksRequests: true })
}
