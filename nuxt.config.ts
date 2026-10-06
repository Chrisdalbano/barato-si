// barato.si — static site (nuxt generate), hosted on GitHub Pages.
const title = 'barato, sí. Las mayores rebajas del día · barato.si'
const description = 'Un índice diario de precios rebajados: las mayores rebajas del día y los posibles errores de precio, ordenados. También en JSON y RSS, gratis y sin clave.'
const ogImage = 'https://barato.si/og.png'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  ssr: true,
  nitro: { preset: 'github-pages' },
  css: ['@fontsource-variable/inter', '~/assets/css/tokens.css', '~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'es', 'data-variant': 'paper' },
      title,
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: description },
        { name: 'theme-color', content: '#f3f0e8' },
        { name: 'color-scheme', content: 'light' },
        { name: 'author', content: "Chris D'Albano" },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'barato.si' },
        { property: 'og:locale', content: 'es_LA' },
        { property: 'og:locale:alternate', content: 'es_ES' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: 'https://barato.si/' },
        { property: 'og:image', content: ogImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'barato, sí. Índice diario de rebajas y posibles errores de precio, en la web, en JSON y en RSS.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
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
        { rel: 'alternate', hreflang: 'es', href: 'https://barato.si/' },
        { rel: 'alternate', hreflang: 'x-default', href: 'https://barato.si/' },
      ],
    },
  },
})
