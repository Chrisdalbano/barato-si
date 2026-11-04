// barato.si — static site (nuxt generate), hosted on GitHub Pages.
// Spanish at /, English at /en/... Each page sets its own title, description,
// canonical and hreflang (composables/useSeo.ts); these are the fallbacks.
const title = 'barato, sí. Índice de precios y errores de precio · barato.si'
const description = 'Los precios de hoy contra lo que cada producto suele costar, con la evidencia a la vista, y los posibles errores de precio. También en JSON y RSS, gratis y sin clave.'
const ogImage = 'https://barato.si/og.png'

// Every page in both languages. Aliases in each page make the English routes;
// these make sure they are prerendered even if no link points at them.
const routes = ['/', '/errores', '/si', '/archivo', '/api', '/privacidad',
  '/en', '/en/errores', '/en/si', '/en/archivo', '/en/api', '/en/privacy']

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
      amazonTag: '', // Associates tag, e.g. barato-20
      // Formship LLC Stripe Payment Link (reader picks the amount, 5 USD preset). Env overrides it.
      supportUrl: 'https://buy.stripe.com/fZucMZb8I3py3e08vK8k801',
      sponsorUrl: '',
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
        { property: 'og:image', content: ogImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { key: 'og:image:alt', property: 'og:image:alt', content: 'barato, sí. Índice de precios y posibles errores de precio, en la web, en JSON y en RSS.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { key: 'twitter:title', name: 'twitter:title', content: title },
        { key: 'twitter:description', name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImage },
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
        { rel: 'alternate', type: 'application/rss+xml', title: 'barato.si · las rebajas del día', href: 'https://barato.si/feed.xml' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'barato.si · posibles errores de precio', href: 'https://barato.si/errors.xml' },
        { rel: 'alternate', type: 'application/json', title: 'barato.si API', href: 'https://barato.si/api/deals.json' },
      ],
    },
  },
})
