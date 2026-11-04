import { es } from '../i18n/es'
import { basePath, localePath } from '../utils/locale'
import { SITE } from '../utils/api'
import { linkFor } from '../utils/deal'
import type { DealView } from './useDeals'

type PageKey = Exclude<keyof typeof es.seo, 'ogLocale' | 'ogAlt' | 'crumbHome' | 'ogImage'>

export const OG_IMAGE = `${SITE}/og.png`
export const ORG_ID = 'https://formship.io/#org'
/** The square brand icon, for JSON-LD (the brand's logo, not Formship's). */
export const BRAND_LOGO = `${SITE}/icon-512.png`

/**
 * Absolute URL for a site path, with the trailing slash the static host serves:
 * GitHub Pages answers /errores with a redirect to /errores/, so the canonical
 * names the URL that actually returns the page.
 */
export function siteUrl(path: string): string {
  return path === '/' ? `${SITE}/` : `${SITE}${path.replace(/\/+$/, '')}/`
}

/** The publisher, referenced by @id from every page's JSON-LD. */
export function organizationLd() {
  return { '@type': 'Organization', '@id': ORG_ID, name: 'Formship LLC', url: 'https://formship.io' }
}

/** JSON-LD for a <script> body: `<` escaped, so no title can close the tag. */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/** The deal fields an Offer may carry. Nothing else reaches the JSON-LD. */
export type LdDeal = Pick<DealView, 'title' | 'url' | 'storeUrl' | 'image' | 'price' | 'currency' | 'store'>

/**
 * An ItemList of Offers for the rows a page lists, in the order it lists them.
 * Only fields the row shows: name, link (the same one "Ver en" uses), picture,
 * price and currency, seller name. No ratings, reviews, availability or dates we
 * have not seen; a field without a real value is left out. Null when the list is
 * empty: an empty page gets no ItemList, never a padded one.
 */
export function offerListLd(
  deals: readonly LdDeal[],
  list: { id: string; name: string; inLanguage: string; descending?: boolean },
): Record<string, unknown> | null {
  if (!deals.length) return null
  return {
    '@type': 'ItemList',
    '@id': list.id,
    name: list.name,
    inLanguage: list.inLanguage,
    numberOfItems: deals.length,
    ...(list.descending ? { itemListOrder: 'https://schema.org/ItemListOrderDescending' } : {}),
    itemListElement: deals.map((deal, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Offer',
        name: deal.title,
        url: linkFor(deal),
        ...(deal.image ? { image: deal.image } : {}),
        ...(Number.isFinite(deal.price) && deal.currency ? { price: deal.price.toFixed(2), priceCurrency: deal.currency } : {}),
        ...(deal.store?.trim() ? { seller: { '@type': 'Organization', name: deal.store } } : {}),
      },
    })),
  }
}

/** A BreadcrumbList from absolute URLs, first crumb first. Null with fewer than two crumbs. */
export function breadcrumbLd(trail: readonly { name: string; url: string }[]): Record<string, unknown> | null {
  if (trail.length < 2) return null
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  }
}

/**
 * Title, description, Open Graph, Twitter, canonical and hreflang for a page,
 * in the page's language. Subpages also get a BreadcrumbList. The canonical of
 * each language points at itself; x-default is the Spanish page.
 */
export function usePageSeo(key: PageKey, crumb?: { es: string; en: string }) {
  const { locale, t } = useLang()
  const route = useRoute()
  const base = basePath(route.path)
  useSeo(() => ({
    title: t.value.seo[key].title,
    description: t.value.seo[key].description,
    esPath: localePath(base, 'es'),
    enPath: localePath(base, 'en'),
    crumbs: crumb ? [{ name: crumb[locale.value] }] : [],
  }))
}

export interface SeoInput {
  title: string
  description: string
  /** Site paths of this page in each language (no host). */
  esPath: string
  enPath: string
  /** Trail after "Home". The last one is this page; earlier ones need a path. Empty: no BreadcrumbList. */
  crumbs: { name: string; path?: string }[]
}

/** The same as usePageSeo, for pages whose title and paths come from data (category and store pages). */
export function useSeo(input: () => SeoInput) {
  const { locale, t } = useLang()
  useHead(() => {
    const s = t.value.seo
    const page = input()
    const esUrl = siteUrl(page.esPath)
    const enUrl = siteUrl(page.enPath)
    const url = locale.value === 'en' ? enUrl : esUrl
    const crumbs = page.crumbs.length
      ? breadcrumbLd([
          { name: s.crumbHome, url: siteUrl(localePath('/', locale.value)) },
          ...page.crumbs.map((c, i) => ({ name: c.name, url: i === page.crumbs.length - 1 || !c.path ? url : siteUrl(c.path) })),
        ])
      : null
    const script = crumbs
      ? [{ key: 'ld-crumbs', type: 'application/ld+json' as const, innerHTML: ldJson({ '@context': 'https://schema.org', ...crumbs }) }]
      : []
    return {
      htmlAttrs: { lang: locale.value },
      title: page.title,
      meta: [
        { key: 'description', name: 'description', content: page.description },
        { key: 'og:title', property: 'og:title', content: page.title },
        { key: 'og:description', property: 'og:description', content: page.description },
        { key: 'og:url', property: 'og:url', content: url },
        { key: 'og:locale', property: 'og:locale', content: s.ogLocale },
        { key: 'og:locale:alternate', property: 'og:locale:alternate', content: locale.value === 'en' ? 'es_LA' : 'en_US' },
        { key: 'og:image', property: 'og:image', content: s.ogImage },
        { key: 'og:image:alt', property: 'og:image:alt', content: s.ogAlt },
        { key: 'twitter:title', name: 'twitter:title', content: page.title },
        { key: 'twitter:description', name: 'twitter:description', content: page.description },
        { key: 'twitter:image', name: 'twitter:image', content: s.ogImage },
      ],
      link: [
        { key: 'canonical', rel: 'canonical', href: url },
        { key: 'alt-es', rel: 'alternate', hreflang: 'es', href: esUrl },
        { key: 'alt-en', rel: 'alternate', hreflang: 'en', href: enUrl },
        { key: 'alt-default', rel: 'alternate', hreflang: 'x-default', href: esUrl },
      ],
      script,
    }
  })
}
