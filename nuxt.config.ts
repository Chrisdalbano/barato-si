// barato.si — static site (nuxt generate), hosted on GitHub Pages.
const title = 'barato.si · chollos y errores de precio del día'
const description = 'Los chollos más profundos y los probables errores de precio de cada día, ordenados. También en JSON y RSS, gratis y sin clave.'
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
        { property: 'og:locale', content: 'es_ES' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: 'https://barato.si/' },
        { property: 'og:image', content: ogImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'barato.si: chollos y errores de precio del día, en una web, en JSON y en RSS.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImage },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'barato.si · chollos del día', href: 'https://barato.si/feed.xml' },
        { rel: 'alternate', type: 'application/json', title: 'barato.si API', href: 'https://barato.si/api/deals.json' },
        { rel: 'alternate', hreflang: 'es', href: 'https://barato.si/' },
        { rel: 'alternate', hreflang: 'x-default', href: 'https://barato.si/' },
      ],
    },
  },
})
