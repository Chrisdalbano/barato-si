// Short explainers for deal season (/guia/<slug>, /en/guide/<slug>). Only the
// slugs live here, so the pipeline (sitemap, IndexNow) and the site (routes,
// prerender list, hreflang) announce the same set. The text is in
// app/utils/guides.ts.

/** Spanish slug -> English slug, in the order the hub lists them. */
export const GUIDE_SLUGS = {
  'cuando-es-black-friday-2026': 'when-is-black-friday-2026',
  'precio-antes-inflado': 'fake-was-price',
  'por-que-cancelan-errores-de-precio': 'why-stores-cancel-price-errors',
  'para-que-sirve-cyber-monday': 'what-cyber-monday-is-good-for',
  'tarjetas-de-regalo-black-friday': 'gift-card-deals-black-friday',
} as const

export type GuideSlug = keyof typeof GUIDE_SLUGS

export function isGuide(slug: string | undefined | null): slug is GuideSlug {
  return typeof slug === 'string' && Object.prototype.hasOwnProperty.call(GUIDE_SLUGS, slug)
}

/** The Spanish slug for an English one; null when there is no such guide. */
export function guideFromEnSlug(en: string): GuideSlug | null {
  const hit = (Object.keys(GUIDE_SLUGS) as GuideSlug[]).find(es => GUIDE_SLUGS[es] === en)
  return hit ?? null
}

/** Both paths of every guide, without the trailing slash. */
export function guidePaths(): { es: string; en: string }[] {
  return (Object.keys(GUIDE_SLUGS) as GuideSlug[]).map(es => ({ es: `/guia/${es}`, en: `/en/guide/${GUIDE_SLUGS[es]}` }))
}
