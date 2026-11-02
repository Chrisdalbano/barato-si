<script setup lang="ts">
import { applyFilters, filtersFromQuery } from '~/utils/filters'

const day = await useToday()

// Candidates with evidence lead the page; /errores has the rest and every signal.
const TOP = 6
const candidates = computed(() => byEvidence((day.value?.deals ?? []).filter(d => d.errorScore >= ERROR_LEVELS[0])))
const top = computed(() => candidates.value.slice(0, TOP))

useHead({
  link: [{ rel: 'canonical', href: `${SITE}/` }],
})

// JSON-LD is built from the same data as the page, and from the rows its default
// list shows, so the prerendered HTML describes the offers actually listed on it.
useHead(() => {
  const d = day.value
  const graph: Record<string, unknown>[] = [{
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    name: 'barato.si',
    alternateName: 'barato, sí',
    url: `${SITE}/`,
    inLanguage: 'es',
    description: 'Los precios de hoy contra lo que cada producto suele costar, y los posibles errores de precio. Con API JSON y RSS gratis.',
    author: { '@type': 'Person', name: "Chris D'Albano", url: 'https://chrisdalbano.com' },
  }]
  const listed = d ? applyFilters(d.deals, filtersFromQuery({}, true, d.deals.some(x => x.direct))).slice(0, 10) : []
  if (d && listed.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${SITE}/#ofertas`,
      name: `Ofertas del ${formatDay(d.date)} en barato.si`,
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
      <DealExplorer
        v-if="day.deals.length" :deals="day.deals" :generated-at="day.generatedAt"
        hide-games direct-default :shown-above="top.map(d => d.id)"
      />
      <section v-else class="calm">
        <p class="calm__big">Hoy, nada barato de verdad.</p>
        <p>
          Ninguna oferta pasó el filtro, o las fuentes no respondieron. No rellenamos el hueco con ofertas viejas.
          El índice se actualiza cada tres horas. Mira también el <NuxtLink to="/archivo">archivo</NuxtLink>.
        </p>
      </section>
      <GateReport v-if="day.gate" :gate="day.gate" />
    </template>
    <section v-else class="calm">
      <p class="calm__big">No pudimos leer la lista de hoy.</p>
      <p>Prueba en un rato, o abre <a href="/api/deals.json">/api/deals.json</a> directamente.</p>
    </section>

    <ApiTeaser />
  </div>
</template>

<style scoped>
.calm { padding: clamp(40px, 6vw, 80px) 0; border-top: 2px solid var(--fg-primary); max-width: var(--container-max-prose); color: var(--fg-secondary); }
.calm__big { margin: 0 0 12px; font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 600; letter-spacing: -0.03em; color: var(--fg-primary); }
</style>
