// barato.si — static site (nuxt generate), hosted on GitHub Pages.
import { readFileSync } from 'node:fs'
import { landingPages, landingPaths } from './lib/landing'
import { guidePaths } from './lib/guides'
// Spanish at /, English at /en/... Each page sets its own title, description,
// canonical and hreflang (composables/useSeo.ts); these are the fallbacks.
const title = 'barato, sí. Índice de precios y errores de precio · barato.si'
const description = 'Los precios de hoy contra lo que cada producto suele costar, con la evidencia a la vista, y los posibles errores de precio. También en JSON y RSS, gratis y sin clave.'
const ogImage = 'https://barato.si/og.png'

// Every page in both languages. Aliases in each page make the English routes;
// these make sure they are prerendered even if no link points at them.
const pages = ['/', '/errores', '/black-friday', '/si', '/semana', '/archivo', '/api', '/anunciate', '/privacidad',
  '/en', '/en/errores', '/en/black-friday', '/en/si', '/en/week', '/en/archivo', '/en/api', '/en/advertise', '/en/privacy']

// Category and store pages: one per slice with deals today, read from the same
// deals.json the pipeline just wrote (and the same lib/landing.ts rules its
// sitemap uses). No file, or nothing in it: no landing pages.
function landingRoutes(): string[] {
  try {
    const file = JSON.parse(readFileSync(new URL('./public/api/deals.json', import.meta.url), 'utf8'))
    return landingPaths(landingPages(Array.isArray(file?.deals) ? file.deals : [])).flatMap(p => [p.es, p.en])
  } catch { return [] }
}
// Deal-season explainers, both languages (lib/guides.ts).
const guideRoutes = guidePaths().flatMap(p => [p.es, p.en])
const routes = [...pages, ...guideRoutes, ...landingRoutes()]

// The Stripe Payment Link for the self-serve sponsored slot (10 USD, one week,
// reviewed before it goes up). NUXT_PUBLIC_SPONSOR_URL overrides it; '' hides the
// footer line. How to switch a sponsor on: UI-NOTES.md, 2026-11-04 v4.1.
const SPONSOR_URL_DEFAULT = 'https://buy.stripe.com/fZubIV1y85xG5m8h2g8k802'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  ssr: true,
  nitro: { preset: 'github-pages', prerender: { routes, crawlLinks: true } },
  css: ['@fontsource-variable/inter', '~/assets/css/tokens.css', '~/assets/css/main.css'],
  // Monetization, all off unless set at build time. Each one renders nothing when empty.
  // Env: NUXT_PUBLIC_ADSENSE_CLIENT, NUXT_PUBLIC_ADSENSE_SLOT_STREAM, NUXT_PUBLIC_ADSENSE_SLOT_FOOTER,
  // NUXT_PUBLIC_AMAZON_TAG, NUXT_PUBLIC_SUPPORT_URL, NUXT_PUBLIC_SPONSOR_URL. See UI-NOTES.md.
  runtimeConfig: {
    public: {
      adsenseClient: '', // ca-pub-…
      adsenseSlotStream: '', // ad unit in the deal stream, after ~12 rows
      adsenseSlotFooter: '', // ad unit above the footer
      amazonTag: 'baratosi-20', // Associates tag (Christian's account, 2026-11-04)
      // Formship LLC Stripe Payment Link (reader picks the amount, 5 USD preset). Env overrides it.
      supportUrl: 'https://buy.stripe.com/fZucMZb8I3py3e08vK8k801',
      sponsorUrl: SPONSOR_URL_DEFAULT,
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'es', 'data-variant': 'paper' },
      title,
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { key: 'description', name: 'description', content: description },
        { name: 'theme-color', content: '#f3f0e8' },
        { name: 'color-scheme', content: 'light' },
        { name: 'author', content: "Chris D'Albano" },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'barato.si' },
        { key: 'og:locale', property: 'og:locale', content: 'es_LA' },
        { key: 'og:title', property: 'og:title', content: title },
        { key: 'og:description', property: 'og:description', content: description },
        { key: 'og:url', property: 'og:url', content: 'https://barato.si/' },
        { key: 'og:image', property: 'og:image', content: ogImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { key: 'og:image:alt', property: 'og:image:alt', content: 'barato, sí. Índice de precios y posibles errores de precio, en la web, en JSON y en RSS.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { key: 'twitter:title', name: 'twitter:title', content: title },
        { key: 'twitter:description', name: 'twitter:description', content: description },
        { key: 'twitter:image', name: 'twitter:image', content: ogImage },
      ],
      script: [
        // Mouseflow (same pattern as chrisdalbano.com). Project f6bd17cc… is barato.si.
        {
          innerHTML: 'window._mfq=window._mfq||[];(function(){var mf=document.createElement("script");mf.type="text/javascript";mf.defer=true;mf.src="//cdn.mouseflow.com/projects/f6bd17cc-9df3-4a8a-baea-69c1121ab594.js";document.getElementsByTagName("head")[0].appendChild(mf);})();',
          type: 'text/javascript',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        // The header wordmark's face (Outfit Medium, 2 KB subset). Preloaded so it is
        // there before first paint; see .brand__name in app.vue.
        { rel: 'preload', href: '/fonts/outfit-500-brand.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'barato.si · las rebajas del día', href: 'https://barato.si/feed.xml' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'barato.si · posibles errores de precio', href: 'https://barato.si/errors.xml' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'barato.si · la semana de Don Centavo', href: 'https://barato.si/semana.xml' },
        { rel: 'alternate', type: 'application/json', title: 'barato.si API', href: 'https://barato.si/api/deals.json' },
      ],
    },
  },
})
