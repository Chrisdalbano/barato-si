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
provideLanding(() => day.value?.deals)

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
  if (d && listed.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${home}#ofertas`,
      name: t.value.home.listName(formatDay(d.date, locale.value)),
      inLanguage: locale.value,
      numberOfItems: listed.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: listed.map((deal, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Offer',
          name: deal.title,
          url: linkFor(deal),
          ...(deal.image ? { image: deal.image } : {}),
          price: deal.price.toFixed(2),
          priceCurrency: deal.currency,
          seller: { '@type': 'Organization', name: deal.store },
        },
      })),
    })
  }
  return {
    script: [{
      key: 'ld-home',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c'),
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
</style>
