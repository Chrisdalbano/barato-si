import type { Deal } from './types.ts'

export function canonicalUrl(value: string): string {
  try {
    const u = new URL(value)
    if (!['http:', 'https:'].includes(u.protocol)) return ''
    u.protocol = 'https:'
    u.hostname = u.hostname.replace(/^www\./, '')
    u.hash = ''
    if (u.hostname === 'store.steampowered.com') {
      const product = /^\/(app|sub|bundle)\/(\d+)/.exec(u.pathname)
      if (product) { u.pathname = `/${product[1]}/${product[2]}/`; u.search = '' }
    }
    for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid|iref|ref|ref_)$/i.test(key)) u.searchParams.delete(key)
    u.searchParams.sort()
    u.pathname = u.pathname.replace(/\/$/, '') || '/'
    return u.toString()
  } catch { return '' }
}

export function dealId(url: string): string {
  // FNV-1a 64-bit is stable in Node and browsers; no crypto or DOM dependency.
  let hash = 14695981039346656037n
  for (const char of canonicalUrl(url)) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0)!)) * 1099511628211n)
  return hash.toString(16).padStart(16, '0')
}

function tokens(title: string): string[] {
  return title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(?:[$€£]\s*\d[\d.,]*|\d[\d.,]*\s*(?:usd|eur|gbp|%\s*off))/g, ' ')
    .replace(/\b(?:free shipping|free delivery|was|now|only|for|at|plus|shipping)\b/g, ' ')
    .match(/[a-z0-9]+/g) || []
}

export function dedupe(deals: Deal[]): Deal[] {
  const result: Deal[] = []
  const gogTitles = new Map<string, Set<string>>()
  for (const d of deals) {
    const identity = productIdentity(d)
    if (!identity?.startsWith('gog:')) continue
    const title = d.title.trim().toLowerCase()
    if (!gogTitles.has(title)) gogTitles.set(title, new Set())
    gogTitles.get(title)!.add(identity)
  }
  // CheapShark has no GOG slug. Resolve exact, unambiguous titles against real
  // catalog slugs in this run, without constructing a guessed merchant URL.
  const identityOf = (d: Deal) => {
    const identity = productIdentity(d)
    const matches = d.store === 'GOG' ? gogTitles.get(d.title.trim().toLowerCase()) : undefined
    return identity || (matches?.size === 1 ? [...matches][0] : null)
  }
  for (const d of deals.map(d => ({ ...d })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    const url = canonicalUrl(d.url)
    const words = new Set(tokens(d.title))
    const duplicate = result.find(other => {
      const identity = identityOf(d)
      if (d.currency === other.currency && identity && identity === identityOf(other)) return true
      if (d.currency === other.currency && d.ai?.product && other.ai?.product && d.ai.product.toLowerCase() === other.ai.product.toLowerCase() && closePrice(d, other)) return true
      if (url && url === canonicalUrl(other.url)) return true
      if (d.currency !== other.currency || Math.abs(d.price - other.price) > .02) return false
      const theirs = new Set(tokens(other.title))
      if (words.size < 3 || theirs.size < 3) return false
      // Model/capacity numbers must agree even when the remaining words are similar.
      if ([...words].filter(w => /\d/.test(w)).sort().join() !== [...theirs].filter(w => /\d/.test(w)).sort().join()) return false
      const intersection = [...words].filter(w => theirs.has(w)).length
      return intersection / (words.size + theirs.size - intersection) >= .88
    })
    if (!duplicate) result.push(d)
    else {
      const sameProduct = identityOf(d) && identityOf(d) === identityOf(duplicate)
      const preferNew = sameProduct && (closePrice(d, duplicate) ? direct(d) && !direct(duplicate) : d.price < duplicate.price)
      const kept = preferNew ? d : duplicate, dropped = preferNew ? duplicate : d
      kept.image ||= dropped.image
      kept.storeUrl ||= dropped.storeUrl
      if (preferNew) result[result.indexOf(duplicate)] = kept
    }
  }
  return result.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

const direct = (d: Deal) => ['Steam', 'GOG'].includes(d.source)
const closePrice = (a: Deal, b: Deal) => Math.abs(a.price - b.price) <= Math.max(a.price, b.price) * .02
function productIdentity(d: Deal): string | null {
  for (const link of [d.storeUrl, d.url]) {
    if (!link) continue
    try {
      const u = new URL(link)
      const steam = u.hostname === 'store.steampowered.com' && /^\/app\/(\d+)/.exec(u.pathname)
      if (steam) return 'steam:' + steam[1]
      const gog = /^(www\.)?gog.com$/.test(u.hostname) && /\/game\/([^/]+)/.exec(u.pathname)
      if (gog) return 'gog:' + gog[1]
    } catch {}
  }
  return null
}
