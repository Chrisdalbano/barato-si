// Amazon Associates tagging. Deliberately narrow: only a canonical
// amazon.com/dp/<ASIN> link with no affiliate parameter of any kind gets our
// tag. Someone else's tag is never replaced, and no other link is touched.

const AMAZON_HOSTS = new Set(['amazon.com', 'www.amazon.com'])
const DP_PATH = /^\/dp\/[A-Z0-9]{10}\/?$/
/** Parameters that mean a link already carries attribution. */
const AFFILIATE_PARAMS = ['tag', 'ascsubtag', 'linkcode', 'linkid', 'camp', 'creative', 'creativeasin', 'ref_']
const TAG_SHAPE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/

export interface Outbound { href: string; sponsored: boolean }

export function affiliateLink(url: string, tag: string | null | undefined): Outbound {
  const t = (tag ?? '').trim()
  if (!t || !TAG_SHAPE.test(t)) return { href: url, sponsored: false }
  let u: URL
  try { u = new URL(url) } catch { return { href: url, sponsored: false } }
  if (u.protocol !== 'https:' || !AMAZON_HOSTS.has(u.hostname.toLowerCase()) || !DP_PATH.test(u.pathname)) return { href: url, sponsored: false }
  const keys = [...u.searchParams.keys()].map(k => k.toLowerCase())
  if (keys.some(k => AFFILIATE_PARAMS.includes(k))) return { href: url, sponsored: false }
  u.searchParams.set('tag', t)
  return { href: u.toString(), sponsored: true }
}

/** rel for an outbound link: paid links say so to search engines. */
export function relFor(o: Outbound): string {
  return o.sponsored ? 'sponsored nofollow noopener' : 'noopener'
}
