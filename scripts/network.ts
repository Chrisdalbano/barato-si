import { USER_AGENT, robotsAllowed } from '../lib/robots.ts'
import type { Source } from '../lib/normalize.ts'

export function createSourceReader(fetcher: typeof fetch = fetch, timeout = 15000) {
  const robots = new Map<string, Promise<string>>()
  async function request(url: string, apiKey?: string): Promise<{ status: number; body: string }> {
    const response = await fetcher(url, { headers: { 'User-Agent': USER_AGENT, ...(apiKey ? { 'ITAD-API-Key': apiKey } : {}), Accept: 'application/json, application/rss+xml, application/atom+xml, text/plain;q=0.9' }, redirect: 'manual', signal: AbortSignal.timeout(timeout) })
    if (response.status >= 300 && response.status < 400) throw new Error(`Redirect refused (HTTP ${response.status}); review target and robots before changing source URL`)
    const chunks: Uint8Array[] = []
    let length = 0
    if (response.body) for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      length += chunk.length
      if (length > 4_000_000) throw new Error('Response exceeds 4 MB limit')
      chunks.push(chunk)
    }
    return { status: response.status, body: Buffer.concat(chunks).toString('utf8') }
  }
  return async (source: Source): Promise<string> => {
    if (source.disabled) throw new Error(source.disabled)
    const origin = new URL(source.url).origin
    // Owner-approved exceptions apply only to these exact API endpoints.
    const endpoint = new URL(source.url)
    const ownerApproved = (source.kind === 'cheapshark' && origin === 'https://www.cheapshark.com' && endpoint.pathname === '/api/1.0/deals')
      || (source.kind === 'steam' && origin === 'https://store.steampowered.com' && endpoint.pathname === '/api/featuredcategories')
      || (source.kind === 'epic' && origin === 'https://store-site-backend-static.ak.epicgames.com' && endpoint.pathname === '/freeGamesPromotions')
    if (!ownerApproved) {
      if (!robots.has(origin)) robots.set(origin, (async () => {
        const r = await request(origin + '/robots.txt')
        if ([404, 410].includes(r.status)) return ''
        if (r.status !== 200 || /<(?:html|!doctype)/i.test(r.body)) throw new Error(`robots.txt unavailable or invalid (HTTP ${r.status})`)
        return r.body
      })())
      const policy = await robots.get(origin)!
      if (!robotsAllowed(policy, source.url)) throw new Error('Blocked by robots.txt; endpoint was not requested')
      const delay = Math.max(0, ...[...policy.matchAll(/^\s*crawl-delay:\s*([\d.]+)/gim)].map(m => Number(m[1])))
      if (delay > 30) throw new Error('Crawl-delay exceeds run budget')
      if (delay) await new Promise(resolve => setTimeout(resolve, delay * 1000))
    }
    const response = await request(source.url, source.apiKey)
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`)
    return response.body
  }
}
