<script setup lang="ts">
import type { LocationQuery } from 'vue-router'

useSeoMeta({
  title: 'Errores de precio · barato.si',
  description: 'Los precios de hoy que parecen un error de la tienda, con la evidencia y las señales que lo sugieren. Una suposición automática, nunca una confirmación.',
  ogTitle: 'Errores de precio · barato.si',
  ogUrl: `${SITE}/errores`,
})
useHead({ link: [{ rel: 'canonical', href: `${SITE}/errores` }] })

const data = await useErrors()
const all = computed(() => data.value?.deals ?? [])

// Filters live in the query string (?min=40|55|70&cat=&tienda=&evidencia=), read
// after mount so the prerendered HTML is always the default view.
const route = useRoute()
const router = useRouter()
const ready = ref(false)
onMounted(() => { ready.value = true })
const one = (v: LocationQuery[string] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? ''
const query = computed<LocationQuery>(() => (ready.value ? route.query : {}))
const min = computed<number>(() => {
  const n = Number(one(query.value.min))
  return (ERROR_LEVELS as readonly number[]).includes(n) ? n : ERROR_LEVELS[0]
})
const store = computed(() => one(query.value.tienda))
const category = computed(() => one(query.value.cat))
const evidence = computed(() => one(query.value.evidencia))

function set(patch: Record<string, string | number | null>) {
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
    const value = Array.isArray(v) ? v[0] : v
    if (value !== null && value !== undefined && value !== '') next[k] = String(value)
  }
  if (next.min === String(ERROR_LEVELS[0])) delete next.min
  router.replace({ query: next })
}

// Only options with something behind them; each list respects the others.
const inLevel = computed(() => all.value.filter(d => d.errorScore >= min.value))
const levels = computed(() => ERROR_LEVELS
  .map(l => ({ level: l as number, count: all.value.filter(d => d.errorScore >= l).length }))
  .filter(o => o.count))
const categories = computed(() => tally(inLevel.value.filter(d => (!store.value || d.store === store.value) && (!evidence.value || evidenceOf(d) === evidence.value)).map(d => d.category)))
const stores = computed(() => tally(inLevel.value.filter(d => (!category.value || d.category === category.value) && (!evidence.value || evidenceOf(d) === evidence.value)).map(d => d.store)))
const kinds = computed(() => {
  const rows = tally(inLevel.value.filter(d => (!category.value || d.category === category.value) && (!store.value || d.store === store.value)).map(evidenceOf))
  return EVIDENCE_ORDER.flatMap((key) => { const hit = rows.find(r => r[0] === key); return hit ? [{ key, label: EVIDENCE[key].label, count: hit[1] }] : [] })
})
const shown = computed(() => inLevel.value.filter(d => (!category.value || d.category === category.value) && (!store.value || d.store === store.value) && (!evidence.value || evidenceOf(d) === evidence.value)))
const filtered = computed(() => min.value !== ERROR_LEVELS[0] || !!category.value || !!store.value || !!evidence.value)

// Led by the highest evidence. The strength tiers are the page's own headings,
// so a seller's unverified list price never sits among observed prices.
const TIERS = [
  { id: 'fuerte', title: 'Con precios observados', note: 'Contrastado con lo que este índice ha visto o con otra tienda.' },
  { id: 'media', title: 'Con una referencia curada o reportada', note: 'Un precio de referencia fechado, o el precio anterior que reporta una fuente. Este índice no lo ha observado.' },
  { id: 'debil', title: 'Solo la palabra del vendedor', note: 'El precio de lista lo pone quien vende y nadie lo ha verificado. La evidencia más débil.' },
  { id: 'ninguna', title: 'Sin referencia', note: 'Las señales vienen del texto de la fuente, no de un precio comparable.' },
] as const
const groups = computed(() => TIERS
  .map(t => ({ ...t, deals: byEvidence(shown.value.filter(d => strengthOf(d) === t.id)) }))
  .filter(g => g.deals.length))
</script>

<template>
  <div class="wrap">
    <header class="hunt__head">
      <p class="eyebrow">Errores de precio</p>
      <h1 class="hunt__title">Errores de precio<span class="hunt__dot" aria-hidden="true">.</span></h1>
      <p class="hunt__lede">
        Los precios de hoy que parecen un fallo de la tienda, empezando por los que tienen mejor evidencia.
      </p>
      <p class="hunt__warn">
        Las tiendas suelen cancelar los errores de precio. Las puntuaciones son heurísticas: indican
        dónde mirar, no confirman nada. Compruébalo en la tienda antes de comprar.
      </p>
      <p v-if="data" class="hunt__strip">
        <time :datetime="data.date">{{ formatDay(data.date) }}</time>
        <span v-if="all.length">{{ plural(all.length, 'precio sospechoso', 'precios sospechosos') }}</span>
        <span class="hunt__time">Actualizado <time :datetime="data.generatedAt">{{ formatGenerated(data.generatedAt) }}</time>. Cada tres horas.</span>
      </p>
    </header>

    <section v-if="all.length" class="hunt" aria-labelledby="hunt-list">
      <h2 id="hunt-list" class="sr-only">Precios sospechosos</h2>
      <form class="hunt__filters" @submit.prevent>
        <fieldset v-if="levels.length > 1" class="hunt__group">
          <legend>Nivel de error</legend>
          <button
            v-for="o in levels" :key="o.level" type="button" class="seg"
            :aria-pressed="min === o.level" @click="set({ min: o.level })"
          >{{ o.level }}+ <span class="seg__n">{{ o.count }}</span></button>
        </fieldset>
        <label v-if="kinds.length > 1 || evidence" class="hunt__field">
          <span>Evidencia</span>
          <select class="field" :value="evidence" @change="set({ evidencia: ($event.target as HTMLSelectElement).value || null })">
            <option value="">Toda</option>
            <option v-for="k in kinds" :key="k.key" :value="k.key">{{ k.label }} ({{ k.count }})</option>
          </select>
        </label>
        <label v-if="categories.length > 1 || category" class="hunt__field">
          <span>Categoría</span>
          <select class="field" :value="category" @change="set({ cat: ($event.target as HTMLSelectElement).value || null })">
            <option value="">Todas ({{ categories.length }})</option>
            <option v-for="[name, n] in categories" :key="name" :value="name">{{ categoryLabel(name) }} ({{ n }})</option>
          </select>
        </label>
        <label v-if="stores.length > 1 || store" class="hunt__field">
          <span>Tienda</span>
          <select class="field" :value="store" @change="set({ tienda: ($event.target as HTMLSelectElement).value || null })">
            <option value="">Todas ({{ stores.length }})</option>
            <option v-for="[name, n] in stores" :key="name" :value="name">{{ name }} ({{ n }})</option>
          </select>
        </label>
        <p class="hunt__count" aria-live="polite">{{ shown.length }} de {{ all.length }}</p>
      </form>

      <section v-for="g in groups" :key="g.id" class="tier" :aria-labelledby="`tier-${g.id}`">
        <h3 :id="`tier-${g.id}`" class="tier__title">{{ g.title }} <span class="tier__n">{{ g.deals.length }}</span></h3>
        <p class="tier__note">{{ g.note }}</p>
        <ol class="tier__items">
          <li v-for="d in g.deals" :key="d.id"><EvidenceRow :deal="d" full :heading-level="4" /></li>
        </ol>
      </section>

      <div v-if="!shown.length" class="hunt__empty">
        <p>Nada con estos filtros.</p>
        <button v-if="filtered" type="button" class="seg" @click="set({ min: null, cat: null, tienda: null, evidencia: null })">Quitar todo</button>
      </div>
    </section>

    <section v-else class="calm">
      <p class="calm__big">Hoy, ningún precio sospechoso.</p>
      <p>
        Ninguna oferta de hoy tiene señales de error de precio. No bajamos el umbral para llenar la página. Las ofertas
        del día están en la <NuxtLink to="/">portada</NuxtLink>, y las sospechas, cuando las hay, también salen en
        <a href="/errors.xml">errors.xml</a>.
      </p>
    </section>
  </div>
</template>

<style scoped>
.hunt__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); }
.hunt__title { margin: 6px 0 10px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.hunt__dot { color: var(--accent-lead); }
.hunt__lede { margin: 0 0 8px; max-width: var(--container-max-prose); font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-primary); }
.hunt__warn { margin: 0 0 clamp(16px, 2vw, 24px); max-width: var(--container-max-prose); font-size: 0.875rem; color: var(--fg-secondary); }
.hunt__strip {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 0; margin: 0; padding: 7px 0;
  border-top: 2px solid var(--fg-primary); border-bottom: 1px solid var(--fg-primary);
  font-size: 0.8125rem; font-weight: 500; font-variant-numeric: tabular-nums;
}
.hunt__strip > :first-child { font-weight: 600; }
.hunt__strip > :first-child::first-letter { text-transform: uppercase; }
.hunt__strip > * + *::before { content: ''; display: inline-block; width: 1px; height: 0.85em; margin: 0 0.85em; background: var(--border-strong); vertical-align: -0.05em; }
.hunt__time { margin-left: auto; color: var(--fg-secondary); font-weight: 400; }
.hunt__time::before { display: none !important; }

.hunt__filters { display: flex; flex-wrap: wrap; align-items: end; gap: 12px 24px; margin: 0 0 8px; padding: 0 0 14px; border-bottom: 1px solid var(--border); }
.hunt__filters fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
.hunt__filters legend, .hunt__field > span { display: block; margin-bottom: 4px; padding: 0; font-size: 0.75rem; color: var(--fg-secondary); }
.hunt__group { display: flex; flex-wrap: wrap; }
.hunt__group legend { width: 100%; }
.hunt__group .seg { height: 34px; font-size: 0.8125rem; }
.hunt__field { display: grid; min-width: 0; max-width: 100%; }
.hunt__field select { min-width: 0; width: 100%; height: 34px; padding-right: 24px; max-width: 15rem; font-size: 0.8125rem; }
.hunt__count { margin: 0 0 0 auto; font-family: var(--font-mono); font-size: 0.8125rem; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
.seg__n { margin-left: 0.35em; font-family: var(--font-mono); font-size: 0.75rem; opacity: 0.7; font-variant-numeric: tabular-nums; }

.tier { padding-top: clamp(16px, 2vw, 24px); }
.tier__title { margin: 0; font-size: 1.125rem; font-weight: 600; letter-spacing: -0.015em; }
.tier__n { margin-left: 0.25em; font-family: var(--font-mono); font-size: 0.875rem; font-weight: 400; color: var(--fg-secondary); }
.tier__note { margin: 2px 0 10px; font-size: 0.8125rem; color: var(--fg-secondary); }
.tier__items { margin: 0; padding: 0; list-style: none; border-bottom: 1px solid var(--border); }

.hunt__empty { padding: 32px 0; color: var(--fg-secondary); }
.hunt__empty p { margin: 0 0 12px; font-size: 1.0625rem; color: var(--fg-primary); }

.calm { padding: clamp(24px, 4vw, 48px) 0; max-width: var(--container-max-prose); color: var(--fg-secondary); }
.calm__big { margin: 0 0 8px; font-size: clamp(1.25rem, 2.4vw, 1.75rem); font-weight: 600; letter-spacing: -0.025em; color: var(--fg-primary); }

@media (max-width: 640px) {
  .hunt__strip { column-gap: 14px; }
  .hunt__strip > * + *::before { display: none; }
  .hunt__time { margin-left: 0; flex-basis: 100%; }
  .hunt__count { margin-left: 0; }
}
</style>
