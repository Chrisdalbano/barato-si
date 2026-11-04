import { es } from '../i18n/es'
import { basePath, localePath } from '../utils/locale'
import { SITE } from '../utils/api'

type PageKey = Exclude<keyof typeof es.seo, 'ogLocale' | 'ogAlt' | 'crumbHome'>

export const OG_IMAGE = `${SITE}/og.png`
export const ORG_ID = 'https://formship.io/#org'

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

/**
 * Title, description, Open Graph, Twitter, canonical and hreflang for a page,
 * in the page's language. Subpages also get a BreadcrumbList. The canonical of
 * each language points at itself; x-default is the Spanish page.
 */
export function usePageSeo(key: PageKey, crumb?: { es: string; en: string }) {
  const { locale, t } = useLang()
  const route = useRoute()
  const base = basePath(route.path)
  const esUrl = siteUrl(localePath(base, 'es'))
  const enUrl = siteUrl(localePath(base, 'en'))

  useHead(() => {
    const s = t.value.seo
    const page = s[key]
    const url = locale.value === 'en' ? enUrl : esUrl
    const script = crumb
      ? [{
          key: 'ld-crumbs',
          type: 'application/ld+json' as const,
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: s.crumbHome, item: siteUrl(localePath('/', locale.value)) },
              { '@type': 'ListItem', position: 2, name: crumb[locale.value], item: url },
            ],
          }).replace(/</g, '\\u003c'),
        }]
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
        { key: 'og:image:alt', property: 'og:image:alt', content: s.ogAlt },
        { key: 'twitter:title', name: 'twitter:title', content: page.title },
        { key: 'twitter:description', name: 'twitter:description', content: page.description },
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
