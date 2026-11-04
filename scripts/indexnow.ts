// Tells IndexNow (Bing, Yandex, Seznam, Naver...) which barato.si pages changed.
// Run after a deploy: node --experimental-strip-types scripts/indexnow.ts
// Never fails the build: any problem is logged and the exit code stays 0.
// The key file public/<INDEXNOW_KEY>.txt is committed and static; the pipeline
// does not write or delete it (scripts/outputs.ts only replaces named files).
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { landingPages, landingPaths } from '../lib/landing.ts'

export const INDEXNOW_KEY = '29c0951cd3928e86c5f663696aa6765c'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const HOST = 'barato.si'
const SITE = `https://${HOST}`

/** Pages whose content follows the day's data, in both languages, with the trailing slash the host serves. */
export const DAILY_PATHS = ['/', '/en/', '/errores/', '/en/errores/', '/si/', '/en/si/', '/semana/', '/en/week/']

export interface IndexNowPayload { host: string; key: string; keyLocation: string; urlList: string[] }

/** The request body: the daily pages plus every category and store page with deals today. */
export function buildPayload(deals: readonly { category?: string | null; store?: string | null }[], key = INDEXNOW_KEY): IndexNowPayload {
  const landing = landingPaths(landingPages(deals)).flatMap(p => [p.es, p.en]).map(p => `${p}/`)
  const urlList = [...new Set([...DAILY_PATHS, ...landing])].map(p => SITE + p).slice(0, 10_000)
  return { host: HOST, key, keyLocation: `${SITE}/${key}.txt`, urlList }
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    const file = JSON.parse(await readFile(join(root, 'public/api/deals.json'), 'utf8'))
    const payload = buildPayload(Array.isArray(file?.deals) ? file.deals : [])
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    })
    // 200 = received, 202 = accepted pending key check. Anything else is logged, not fatal.
    console.log(`IndexNow: HTTP ${res.status} for ${payload.urlList.length} URLs`)
    if (res.status >= 400) console.log((await res.text()).slice(0, 300))
  } catch (err) {
    console.log(`IndexNow: not sent (${err instanceof Error ? err.message : String(err)})`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
