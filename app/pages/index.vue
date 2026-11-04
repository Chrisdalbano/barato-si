<script setup lang="ts">
import { applyFilters, filtersFromQuery } from '~/utils/filters'

definePageMeta({ alias: ['/en'] })

const { locale, t, lp } = useLang()
usePageSeo('home')

const day = await useToday()
const highlights = await useHighlights()
const oracle = await useOracle()
provideOracle(oracle)
// Category and store names in the list link to their pages (they all exist today).
// The same set is listed once near the end, so every built slice page has a plain
// link from the home page, not only from rows inside the first chunk of the list.
const landing = provideLanding(() => day.value?.deals)

// Candidates with evidence lead the page; /errores has the rest and every signal.
const TOP = 6
const candidates = computed(() => byEvidence((day.value?.deals ?? []).filter(d => d.errorScore >= ERROR_LEVELS[0])))
const top = computed(() => candidates.value.slice(0, TOP))

// JSON-LD is built from the same data as the page, and from the rows its default
// list shows, so the prerendered HTML describes the offers actually listed on it.
// Only real fields: no ratings, no reviews, no availability we have not seen.
useHead(() => {
  const d = day.value
  const home = siteUrl(lp('/'))
  const graph: Record<string, unknown>[] = [
    // The publisher is Formship LLC; barato.si's own logo belongs to the brand, not to it.
    { ...organizationLd(), brand: { '@type': 'Brand', name: 'barato.si', logo: BRAND_LOGO } },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: 'barato.si',
      alternateName: 'barato, sí',
      url: `${SITE}/`,
      image: BRAND_LOGO,
      inLanguage: ['es', 'en'],
      description: t.value.home.siteDescription,
      publisher: { '@id': ORG_ID },
      author: { '@type': 'Person', name: "Chris D'Albano", url: 'https://chrisdalbano.com' },
      // The search box on this page filters the list from ?q=, so this is a real search.
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${home}?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
  ]
  const listed = d ? applyFilters(d.deals, filtersFromQuery({}, true, d.deals.some(x => x.direct))).slice(0, 10) : []
  const list = d
    ? offerListLd(listed, { id: `${home}#ofertas`, name: t.value.home.listName(formatDay(d.date, locale.value)), inLanguage: locale.value, descending: true })
    : null
  if (list) graph.push(list)
  return {
    script: [{
      key: 'ld-home',
      type: 'application/ld+json',
      innerHTML: ldJson({ '@context': 'https://schema.org', '@graph': graph }),
    }],
  }
})
</script>

<template>
  <div class="wrap">
    <Masthead :day="day" />
    <template v-if="day">
      <EvidenceBoard :deals="top" :total="candidates.length" />
      <SponsorSlot />
      <HighlightRows :highlights="highlights" :deals="day.deals" :date="day.date" />
      <DealExplorer
        v-if="day.deals.length" :deals="day.deals" :generated-at="day.generatedAt"
        hide-games direct-default ads :shown-above="top.map(d => d.id)"
      />
      <section v-else class="calm">
        <p class="calm__big">{{ t.home.calmBig }}</p>
        <p>{{ t.home.calmBody }} <NuxtLink :to="lp('/archivo')">{{ t.home.calmArchive }}</NuxtLink>.</p>
      </section>
      <nav v-if="landing.categories.length || landing.stores.length" class="slices" :aria-label="t.home.slices">
        <div v-if="landing.categories.length" class="slices__group">
          <h2 class="slices__title">{{ t.home.byCategory }}</h2>
          <ul class="slices__list">
            <li v-for="c in landing.categories" :key="c.slug">
              <NuxtLink :to="categoryPath(c.category, locale)!">{{ categoryLabel(c.category, locale) }}</NuxtLink> <span class="slices__n">{{ c.count }}</span>
            </li>
          </ul>
        </div>
        <div v-if="landing.stores.length" class="slices__group">
          <h2 class="slices__title">{{ t.home.byStore }}</h2>
          <ul class="slices__list">
            <li v-for="s in landing.stores" :key="s.slug">
              <NuxtLink :to="storePath(s.name, locale)!">{{ s.name }}</NuxtLink> <span class="slices__n">{{ s.count }}</span>
            </li>
          </ul>
        </div>
      </nav>
      <GateReport v-if="day.gate" :gate="day.gate" />
    </template>
    <section v-else class="calm">
      <p class="calm__big">{{ t.home.failBig }}</p>
      <p>{{ t.home.failBody }} <a href="/api/deals.json">/api/deals.json</a> {{ t.home.failBody2 }}</p>
    </section>

    <ApiTeaser />
  </div>
</template>

<style scoped>
.calm { padding: clamp(40px, 6vw, 80px) 0; border-top: 2px solid var(--fg-primary); max-width: var(--container-max-prose); color: var(--fg-secondary); }
.calm__big { margin: 0 0 12px; font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 600; letter-spacing: -0.03em; color: var(--fg-primary); }
/* Same look as the "other categories / stores" block on the slice pages. */
.slices { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 24px 48px; margin-top: clamp(32px, 4vw, 48px); padding-top: 20px; border-top: 1px solid var(--fg-primary); }
.slices__title { margin: 0 0 8px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-secondary); }
.slices__list { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; }
.slices__list a { color: var(--fg-primary); text-underline-offset: 3px; }
.slices__list a:hover { color: var(--link-fg); }
.slices__n { font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); }
</style>
