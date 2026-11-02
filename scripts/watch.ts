import { readFile, writeFile, rename, mkdir, open, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createSourceReader } from './network.ts'
import { plainText } from '../lib/feeds.ts'
import type { Deal } from '../lib/types.ts'

export interface WatchRule { name: string; title: string; maxPrice?: number; urls?: string[] }
export interface Observation { title: string; url: string; price?: number; currency?: string; available?: boolean; status: 'ok' | 'blocked' | 'unavailable'; at: string }
export interface WatchHistory { observations: Record<string, Observation[]>; fired: string[] }
export function parseOffers(html: string, url: string, at: string): Observation[] {
  const found: Observation[] = []
  function walk(value: any, inherited = ''): void {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const v of value) walk(v,inherited); return }
    const title = typeof value.name === 'string' ? plainText(value.name) : inherited
    if (value.offers) {
      const offers = Array.isArray(value.offers) ? value.offers : [value.offers]
      for (const offer of offers) {
        const price = typeof offer.price === 'string' && offer.price.trim() || typeof offer.price === 'number' ? Number(offer.price) : NaN
        const availability = String(offer.availability || '').split('/').at(-1)
        if (Number.isFinite(price) && price >= 0 && /^[A-Z]{3}$/.test(offer.priceCurrency || '') && ['InStock','OutOfStock','SoldOut','Discontinued','PreOrder','BackOrder','LimitedAvailability'].includes(availability!)) {
          found.push({ title, url, price, currency: offer.priceCurrency, available: ['InStock','LimitedAvailability'].includes(availability!), status: 'ok', at })
        }
      }
    }
    for (const [key,v] of Object.entries(value)) if (key !== 'offers') walk(v,title)
  }
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { walk(JSON.parse(match[1]!)) } catch { /* malformed JSON-LD is not evidence */ }
  }
  return found
}
// Pages without JSON-LD. CamelCamelCamel's history table gives current and lowest prices for
// Amazon and third-party sellers; a plain store page gives a visible price and stock words.
const pageText = (html: string) => plainText(html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')).replace(/\s+/g, ' ')
const pageTitle = (html: string) => plainText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').split(/\s\|\s/)[0]!.trim()
export function parseCamel(html: string, url: string, at: string): Observation[] {
  const text = pageText(html), title = pageTitle(html), found: Observation[] = []
  const money = '\\$[\\d,]+(?:\\.\\d\\d)?(?: \\([^)]*\\))?'
  for (const [label, seller] of [['Amazon', 'Amazon'], ['3rd Party New', 'terceros']] as const) {
    const row = new RegExp(`${label} (${money}) (${money}) (-|\\$[\\d,]+(?:\\.\\d\\d)?(?: \\([^)]*\\))?) `).exec(text)
    if (!row) continue
    const current = row[3] === '-' ? NaN : Number(row[3]!.replace(/[$,]|\s*\(.*$/g, ''))
    const low = row[1]!.replace(/\s*\(.*$/, '')
    found.push({ title: `${title} (${seller}, mínimo ${low})`, url: url + '#' + seller, ...(Number.isFinite(current) ? { price: current, currency: 'USD' } : {}), available: Number.isFinite(current), status: Number.isFinite(current) ? 'ok' : 'unavailable', at })
  }
  return found
}
export function parseStorePage(html: string, url: string, at: string): Observation[] {
  const text = pageText(html), title = pageTitle(html)
  if (/\b(?:backorder|out of stock|sold out)\b/i.test(text)) return [{ title, url, available: false, status: 'unavailable', at }]
  const price = /\$([\d,]+\.\d\d)/.exec(text)?.[1]
  return price && /add to cart|buy now/i.test(text) ? [{ title, url, price: Number(price.replace(/,/g, '')), currency: 'USD', available: true, status: 'ok', at }] : []
}
export function fireReasons(rule: WatchRule, current: Observation, previous?: Observation): string[] {
  if (current.status !== 'ok' || !current.available || current.price === undefined) return []
  const reasons: string[] = []
  if (!previous) reasons.push('Primera observación')
  if (rule.maxPrice !== undefined && current.price <= rule.maxPrice) reasons.push('Precio dentro del máximo')
  if (previous?.price !== undefined && previous.currency === current.currency && current.price <= previous.price * .95 && current.price < previous.price) reasons.push('Baja de al menos 5 %')
  if (previous?.available === false) reasons.push('De nuevo disponible')
  return reasons
}
export async function notifyWatch(title: string, body: string, command?: string): Promise<void> {
  if (!command) { console.log(title + '\n' + body); return }
  // A literal executable path, or JSON argv array; never a shell command.
  const argv: unknown = command.trim().startsWith('[') ? JSON.parse(command) : [command]
  if (!Array.isArray(argv) || !argv.length || !argv.every(v => typeof v === 'string' && v.length)) throw new Error('BARATO_BOARD_CMD must be an executable path or JSON argv array')
  await new Promise<void>((resolve,reject) => {
    const child = spawn(argv[0], argv.slice(1), { shell: false, windowsHide: true, stdio: ['pipe','ignore','ignore'] })
    const timer = setTimeout(() => { child.kill(); reject(new Error('Board command timeout')) }, 15000)
    child.on('error', e => { clearTimeout(timer); reject(e) })
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Board command failed')) })
    child.stdin.on('error', () => {})
    child.stdin.end(JSON.stringify({ title, body }) + '\n')
  })
}
export async function runWatch(repo = fileURLToPath(new URL('../', import.meta.url)), env: Record<string,string|undefined> = process.env): Promise<void> {
  if (env.CI || env.GITHUB_ACTIONS) throw new Error('Private watch must never run in CI')
  const dir = join(repo,'data/private')
  let rules: WatchRule[]
  try { rules = JSON.parse(await readFile(join(dir,'watchlist.json'),'utf8')) } catch(e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') { console.log('Private watch: no rules configured'); return } throw e }
  if (!Array.isArray(rules) || rules.length > 100) throw new Error('Invalid watch rules')
  const names = new Set<string>()
  for (const r of rules) {
    if (!r.name || names.has(r.name) || typeof r.title !== 'string' || (r.maxPrice !== undefined && (!Number.isFinite(r.maxPrice) || r.maxPrice < 0)) || (r.urls && (!Array.isArray(r.urls) || r.urls.length > 20 || r.urls.some(u => new URL(u).protocol !== 'https:')))) throw new Error('Invalid watch rule')
    new RegExp(r.title,'i'); names.add(r.name)
  }
  await mkdir(dir,{recursive:true})
  const lock = await open(join(dir,'watch.lock'),'wx')
  try {
    let history: WatchHistory = { observations: {}, fired: [] }
    try { history = JSON.parse(await readFile(join(dir,'watch-history.json'),'utf8')) } catch(e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
    const now = new Date().toISOString(), read = createSourceReader()
    const observations: Observation[] = []
    try {
      const collected = JSON.parse(await readFile(join(dir,'collected.json'),'utf8'))
      const age = Date.now()-Date.parse(collected.generatedAt)
      if (age >= 0 && age <= 14*3600000) for (const d of collected.deals as Deal[]) observations.push({ title: d.title, url: d.storeUrl || d.url, price: d.price, currency: d.currency, available: true, status: 'ok', at: collected.generatedAt })
    } catch(e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
    const urls = [...new Set(rules.flatMap(r => r.urls || []))]
    for (const url of urls) {
      try {
        const html = await read({ name: 'Private watch', kind: 'rss', url }, { signal: AbortSignal.timeout(30000) })
        if (/<title>[^<]*just a moment|cf-chl-|verify you are human/i.test(html)) throw new Error('Challenge')
        const ld = parseOffers(html,url,now)
        const prices = ld.length ? ld : new URL(url).hostname.endsWith('camelcamelcamel.com') ? parseCamel(html,url,now) : parseStorePage(html,url,now)
        observations.push(...(prices.length ? prices : [{ title: '', url, status: 'unavailable' as const, at: now }]))
      } catch { observations.push({ title: '', url, status: 'blocked', at: now }) }
    }
    for (const rule of rules) {
      const regex = new RegExp(rule.title,'i')
      for (const current of observations.filter(o => regex.test(o.title) || (o.status !== 'ok' && rule.urls?.includes(o.url.split('#')[0]!)))) {
        const key = JSON.stringify([rule.name,current.url,current.currency || ''])
        const series = history.observations[key] ||= []
        const previous = series.filter(o => o.status === 'ok').at(-1)
        const reasons = fireReasons(rule,current,previous)
        const fireKey = JSON.stringify([rule.name,current.currency,current.price])
        if (reasons.length && !history.fired.includes(fireKey)) {
          await notifyWatch(rule.name + ': ' + current.title, reasons.join('; ') + '\n' + current.price + ' ' + current.currency + '\n' + current.url,env.BARATO_BOARD_CMD)
          history.fired.push(fireKey)
        }
        // Include rises and blocked observations, not just alert events.
        if (series.at(-1)?.at !== current.at || series.at(-1)?.price !== current.price) series.push(current)
      }
    }
    await writeFile(join(dir,'watch-history.json.tmp'),JSON.stringify(history,null,2)+'\r\n')
    await rename(join(dir,'watch-history.json.tmp'),join(dir,'watch-history.json'))
  } finally { await lock.close(); await rm(join(dir,'watch.lock'),{force:true}) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runWatch().catch(() => { console.error('Private watch failed; inspect local configuration.'); process.exitCode=1 })
