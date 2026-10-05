import type { Deal } from './types.ts'

export function canonicalUrl(value: string): string {
  try {
    const u = new URL(value)
    if (!['http:', 'https:'].includes(u.protocol)) return ''
    u.protocol = 'https:'
    u.hostname = u.hostname.replace(/^www\./, '')
    u.hash = ''
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
  for (const d of [...deals].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    const url = canonicalUrl(d.url)
    const words = new Set(tokens(d.title))
    const duplicate = result.some(other => {
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
  }
  return result
}
