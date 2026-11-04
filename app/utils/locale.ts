// Two languages, no library. Spanish lives at the root, English under /en.
// Pure: no Vue, no Nuxt, so tests and the server can use it the same way.

export type Locale = 'es' | 'en'

/** Spanish path -> English path. Pages not listed get "/en" + the Spanish path. */
const EN_PATH: Record<string, string> = {
  '/': '/en',
  '/privacidad': '/en/privacy',
}
const ES_PATH: Record<string, string> = Object.fromEntries(Object.entries(EN_PATH).map(([es, en]) => [en, es]))

/** Every page in both languages: what nitro prerenders and what hreflang pairs. */
export const PAGES = ['/', '/errores', '/si', '/archivo', '/api', '/privacidad'] as const

const clean = (path: string): string => (path.replace(/\/+$/, '') || '/')

export function localeOfPath(path: string): Locale {
  return /^\/en(?:\/|$)/.test(path) ? 'en' : 'es'
}

/** The Spanish path a route stands for, whatever language it is in. */
export function basePath(path: string): string {
  const p = clean(path)
  if (localeOfPath(p) === 'es') return p
  return ES_PATH[p] ?? (p.slice(3) || '/')
}

/** The same page in `loc`. */
export function localePath(path: string, loc: Locale): string {
  const base = basePath(path)
  if (loc === 'es') return base
  return EN_PATH[base] ?? `/en${base}`
}

/** Intl tag for each language. Spanish numbers stay es-ES to match the pipeline's own strings. */
export const INTL: Record<Locale, string> = { es: 'es-ES', en: 'en-US' }
