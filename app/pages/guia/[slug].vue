<script setup lang="ts">
import { guideFor, guideList, GUIDES_UPDATED } from '~/utils/guides'
import { ORG_ID } from '~/composables/useSeo'

// /guia/<slug>/ and /en/guide/<english slug>/: short deal-season explainers
// (text in utils/guides.ts, slugs in lib/guides.ts). Static prose, linked from
// /black-friday. The examples are dated records from barato.si's own files.
definePageMeta({ alias: ['/en/guide/:slug'] })

const { locale, t, lp } = useLang()
const route = useRoute()

// The Spanish slug, whichever language the URL is in.
const esPath = computed(() => basePath(route.path))
const slug = computed(() => esPath.value.replace(/^\/guia\//, ''))
const guide = computed(() => guideFor(slug.value, locale.value))
if (!guide.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })

const g = computed(() => guide.value!)
const others = computed(() => guideList(locale.value).filter(x => x.slug !== slug.value))
const hubName = computed(() => t.value.hub.title)

useSeo(() => ({
  title: g.value.seoTitle,
  description: g.value.description,
  esPath: esPath.value,
  enPath: localePath(esPath.value, 'en'),
  crumbs: [{ name: hubName.value, path: lp('/black-friday') }, { name: g.value.title }],
}))

useHead(() => ({
  script: [{
    key: 'ld-guide',
    type: 'application/ld+json',
    innerHTML: ldJson({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.value.title,
      description: g.value.description,
      inLanguage: locale.value,
      dateModified: GUIDES_UPDATED,
      mainEntityOfPage: siteUrl(locale.value === 'en' ? localePath(esPath.value, 'en') : esPath.value),
      publisher: { '@id': ORG_ID },
    }),
  }],
}))

const updatedLabel = computed(() => (locale.value === 'en' ? 'Reviewed' : 'Revisado'))
const sourcesLabel = computed(() => (locale.value === 'en' ? 'Sources' : 'Fuentes'))
const moreLabel = computed(() => (locale.value === 'en' ? 'More guides' : 'Más guías'))
const hubLabel = computed(() => (locale.value === 'en' ? "Today's deals, possible price errors first" : 'Las ofertas de hoy, con los posibles errores primero'))
</script>

<template>
  <article class="wrap guide">
    <header class="guide__head">
      <p class="eyebrow"><NuxtLink :to="lp('/black-friday')">{{ hubName }}</NuxtLink></p>
      <h1 class="guide__title">{{ g.title }}<span class="guide__dot" aria-hidden="true">.</span></h1>
      <p class="guide__lede">{{ g.lede }}</p>
      <p class="guide__date">{{ updatedLabel }} <time :datetime="GUIDES_UPDATED">{{ formatDay(GUIDES_UPDATED, locale) }}</time></p>
    </header>

    <section v-for="(s, i) in g.sections" :key="i" class="guide__sec">
      <h2>{{ s.h }}</h2>
      <p v-for="(p, j) in s.p" :key="j">{{ p }}</p>
    </section>

    <section v-if="g.sources.length" class="guide__src">
      <h2>{{ sourcesLabel }}</h2>
      <ul>
        <li v-for="src in g.sources" :key="src.url"><a :href="src.url" rel="noopener" target="_blank">{{ src.label }}</a></li>
      </ul>
    </section>

    <nav class="guide__more" :aria-label="moreLabel">
      <p class="guide__hub"><NuxtLink :to="lp('/black-friday')">{{ hubLabel }}</NuxtLink> <span aria-hidden="true">&rarr;</span></p>
      <h2>{{ moreLabel }}</h2>
      <ul>
        <li v-for="o in others" :key="o.slug"><NuxtLink :to="o.path">{{ o.title }}</NuxtLink></li>
      </ul>
    </nav>
  </article>
</template>

<style scoped>
.guide { max-width: 62rem; }
.guide__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); }
.guide__head .eyebrow a { color: inherit; text-underline-offset: 3px; }
.guide__title { margin: 6px 0 12px; font-size: clamp(1.75rem, 4vw, 3rem); line-height: 1.05; font-weight: 600; letter-spacing: -0.04em; }
.guide__dot { color: var(--accent-lead); }
.guide__lede { margin: 0 0 10px; max-width: var(--container-max-prose); font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-primary); }
.guide__date { margin: 0; font-size: 0.8125rem; color: var(--fg-secondary); }

.guide__sec { padding: clamp(16px, 2.5vw, 28px) 0 4px; border-top: 2px solid var(--fg-primary); max-width: var(--container-max-prose); }
.guide__sec h2, .guide__src h2, .guide__more h2 { margin: 0 0 10px; font-size: clamp(1.125rem, 2vw, 1.375rem); font-weight: 600; letter-spacing: -0.02em; }
.guide__sec p { margin: 0 0 12px; font-size: 0.9375rem; line-height: 1.6; color: var(--fg-primary); }

.guide__src { padding-top: 16px; border-top: 1px solid var(--border); max-width: var(--container-max-prose); font-size: 0.875rem; }
.guide__src ul, .guide__more ul { margin: 0; padding-left: 1.1em; }
.guide__src a, .guide__more a { color: var(--fg-primary); text-underline-offset: 3px; }
.guide__src a:hover, .guide__more a:hover { color: var(--link-fg); }

.guide__more { margin-top: clamp(24px, 3vw, 40px); padding-top: 16px; border-top: 1px solid var(--fg-primary); font-size: 0.9375rem; }
.guide__hub { margin: 0 0 18px; font-weight: 500; }
.guide__more li { margin: 0 0 6px; }
</style>
