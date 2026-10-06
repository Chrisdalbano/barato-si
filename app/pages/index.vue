<script setup lang="ts">
const day = await useToday()

// The file order is the editorial ranking (the pipeline balances the top 30
// across sources, then sorts by score), so the lead is simply the first deal.
const lead = computed(() => day.value?.deals[0])
const now = ref(Date.parse(day.value?.generatedAt ?? '') || 0)
onMounted(() => { now.value = Date.now() })

// Probable price errors get their own section of evidence cards (up to 6;
// /errores has the rest). The lead is already shown large. With no 70+ today,
// the top candidates at 55+ show instead, labelled "Sospechosas".
const watch6 = computed(() => {
  const rest = (day.value?.deals ?? []).filter(d => d.id !== lead.value?.id)
  const probable = rest.filter(d => d.flag === 'error-probable').sort((a, b) => b.errorScore - a.errorScore)
  if (probable.length) return { suspects: false, total: probable.length, deals: probable.slice(0, 6) }
  const near = rest.filter(d => d.errorScore >= 55).sort((a, b) => b.errorScore - a.errorScore)
  return { suspects: true, total: near.length, deals: near.slice(0, 6) }
})
const errors = computed(() => watch6.value.deals)

useHead({
  link: [{ rel: 'canonical', href: `${SITE}/` }],
})

// JSON-LD is built from the same data as the page, so the prerendered HTML
// describes the offers actually listed on it.
useHead(() => {
  const d = day.value
  const graph: Record<string, unknown>[] = [{
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    name: 'barato.si',
    alternateName: 'barato, sí',
    url: `${SITE}/`,
    inLanguage: 'es',
    description: 'Las mayores rebajas del día y los posibles errores de precio, ordenados. Con API JSON y RSS gratis.',
    author: { '@type': 'Person', name: "Chris D'Albano", url: 'https://chrisdalbano.com' },
  }]
  if (d?.deals.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${SITE}/#ofertas`,
      name: `Ofertas del ${formatDay(d.date)} en barato.si`,
      numberOfItems: Math.min(10, d.deals.length),
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: d.deals.slice(0, 10).map((deal, i) => ({
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
      <LeadDeal v-if="lead" :deal="lead" :now="now" />
      <ErrorWatch v-if="errors.length" :deals="errors" :total="watch6.total" :suspects="watch6.suspects" />
      <DealList
        v-if="day.deals.length" :deals="day.deals" :generated-at="day.generatedAt"
        :lead-id="lead?.id" :shown-above="errors.map(d => d.id)"
      />
      <section v-else class="calm">
        <p class="calm__big">Hoy, nada barato de verdad.</p>
        <p>
          Ninguna oferta pasó el filtro, o las fuentes no respondieron. No rellenamos el hueco con ofertas viejas.
          Vuelve mañana después de las 11:00 UTC, o mira el <NuxtLink to="/archivo">archivo</NuxtLink>.
        </p>
      </section>
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
