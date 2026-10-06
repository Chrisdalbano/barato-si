<script setup lang="ts">
import type { LocationQuery } from 'vue-router'

useSeoMeta({
  title: 'Cazador de errores de precio · barato.si',
  description: 'Los precios de hoy que parecen un error de la tienda, con las señales que lo sugieren. Una suposición automática, nunca una confirmación.',
  ogTitle: 'Cazador de errores de precio · barato.si',
  ogUrl: `${SITE}/errores`,
})
useHead({ link: [{ rel: 'canonical', href: `${SITE}/errores` }] })

const data = await useErrors()
const all = computed(() => data.value?.deals ?? [])

// Filters live in the query string (?min=40|55|70&cat=), read after mount so
// the prerendered HTML is always the default view.
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
const category = computed(() => one(query.value.cat))

function set(patch: Record<string, string | number | null>) {
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
    const value = Array.isArray(v) ? v[0] : v
    if (value !== null && value !== undefined && value !== '') next[k] = String(value)
  }
  if (next.min === String(ERROR_LEVELS[0])) delete next.min
  router.replace({ query: next })
}

// Only options with something behind them.
const levels = computed(() => ERROR_LEVELS
  .map(l => ({ level: l as number, count: all.value.filter(d => d.errorScore >= l).length }))
  .filter(o => o.count))
const categories = computed(() => tally(all.value.filter(d => d.errorScore >= min.value).map(d => d.category)))
const shown = computed(() => all.value.filter(d => d.errorScore >= min.value && (!category.value || d.category === category.value)))
const filtered = computed(() => min.value !== ERROR_LEVELS[0] || !!category.value)
</script>

<template>
  <div class="wrap">
    <header class="hunt__head">
      <p class="eyebrow">Errores de precio</p>
      <h1 class="hunt__title">Cazador de errores de precio<span class="hunt__dot" aria-hidden="true">.</span></h1>
      <p class="hunt__lede">
        Los precios de hoy que parecen un fallo de la tienda, de más a menos sospechoso, con las señales que lo sugieren.
        Es una suposición automática: la tienda puede corregir el precio o no respetarlo.
      </p>
      <p v-if="data" class="hunt__strip">
        <time :datetime="data.date">{{ formatDay(data.date) }}</time>
        <span v-if="all.length">{{ plural(all.length, 'precio sospechoso', 'precios sospechosos') }}</span>
        <span class="hunt__time">Actualizado <time :datetime="data.generatedAt">{{ formatGenerated(data.generatedAt) }}</time></span>
      </p>
    </header>

    <section v-if="all.length" class="hunt" aria-labelledby="hunt-list">
      <h2 id="hunt-list" class="sr-only">Precios sospechosos</h2>
      <form class="hunt__filters" @submit.prevent>
        <fieldset v-if="levels.length > 1" class="hunt__group">
          <legend>Sospecha mínima</legend>
          <button
            v-for="o in levels" :key="o.level" type="button" class="seg"
            :aria-pressed="min === o.level" @click="set({ min: o.level })"
          >{{ o.level }} <span class="seg__n">{{ o.count }}</span></button>
        </fieldset>
        <label v-if="categories.length > 1" class="hunt__field">
          <span>Categoría</span>
          <select :value="category" @change="set({ cat: ($event.target as HTMLSelectElement).value || null })">
            <option value="">Todas ({{ categories.length }})</option>
            <option v-for="[name, n] in categories" :key="name" :value="name">{{ categoryLabel(name) }} ({{ n }})</option>
          </select>
        </label>
        <p class="hunt__count" aria-live="polite">{{ shown.length }} de {{ all.length }}</p>
      </form>

      <div class="hunt__grid">
        <ol class="hunt__items">
          <li v-for="d in shown" :key="d.id" class="hunt__cell">
            <ErrorCard :deal="d" wide />
          </li>
        </ol>
      </div>
      <div v-if="!shown.length" class="hunt__empty">
        <p>Nada con estos filtros.</p>
        <button v-if="filtered" type="button" class="seg" @click="set({ min: null, cat: null })">Quitar filtros</button>
      </div>
    </section>

    <section v-else class="calm">
      <p class="calm__big">Hoy, ningún precio sospechoso.</p>
      <p>
        Ninguna oferta de hoy tiene señales de error de precio. Las rebajas del día están en la
        <NuxtLink to="/">portada</NuxtLink>, y las sospechas, cuando las hay, también salen en
        <a href="/errors.xml">errors.xml</a>.
      </p>
    </section>
  </div>
</template>

<style scoped>
.hunt__head { padding: clamp(40px, 6vw, 88px) 0 clamp(24px, 3vw, 40px); }
.hunt__title { margin: 8px 0 16px; font-size: clamp(2.25rem, 6vw, 4.75rem); line-height: 0.98; font-weight: 600; letter-spacing: -0.045em; }
.hunt__dot { color: var(--accent-lead); }
.hunt__lede { margin: 0 0 clamp(24px, 3vw, 36px); max-width: var(--container-max-prose); font-size: clamp(1.0625rem, 1.6vw, 1.25rem); color: var(--fg-secondary); }
.hunt__strip {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 0; margin: 0; padding: 10px 0;
  border-top: 2px solid var(--fg-primary); border-bottom: 1px solid var(--fg-primary);
  font-size: 0.8125rem; font-weight: 500; font-variant-numeric: tabular-nums;
}
.hunt__strip > :first-child { font-weight: 600; }
.hunt__strip > :first-child::first-letter { text-transform: uppercase; }
.hunt__strip > * + *::before { content: ''; display: inline-block; width: 1px; height: 0.85em; margin: 0 0.85em; background: var(--border-strong); vertical-align: -0.05em; }
.hunt__time { margin-left: auto; color: var(--fg-secondary); font-weight: 400; }
.hunt__time::before { display: none !important; }

.hunt__filters { display: flex; flex-wrap: wrap; align-items: end; gap: 16px 28px; margin: 0 0 24px; padding: 4px 0 20px; border-bottom: 1px solid var(--border); }
.hunt__filters fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
.hunt__filters legend, .hunt__field > span { display: block; margin-bottom: 6px; padding: 0; font-size: 0.75rem; color: var(--fg-secondary); }
.hunt__group { display: flex; flex-wrap: wrap; }
.hunt__group legend { width: 100%; }
.hunt__field { display: grid; }
.hunt__field select {
  height: 38px; padding: 0 28px 0 10px; max-width: 16rem; border: 1px solid var(--border-strong); border-radius: 0;
  background: var(--bg-canvas); color: var(--fg-primary); font: inherit; font-size: 0.9375rem;
}
.hunt__count { margin: 0 0 0 auto; font-family: var(--font-mono); font-size: 0.875rem; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
.seg__n { margin-left: 0.35em; font-family: var(--font-mono); font-size: 0.8125rem; opacity: 0.7; font-variant-numeric: tabular-nums; }

/* Ruled cells, two across on wide screens; the wrapper clips the outer left rule. */
.hunt__grid { overflow: hidden; border-bottom: 1px solid var(--border); }
.hunt__items {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 36rem), 1fr));
  margin: 0 0 0 -1px; padding: 0; list-style: none;
}
.hunt__cell {
  padding: clamp(18px, 2.4vw, 28px) clamp(0px, 2vw, 28px);
  border-top: 1px solid var(--border); border-left: 1px solid var(--border); min-width: 0;
  content-visibility: auto; contain-intrinsic-size: auto 360px;
}
.hunt__empty { padding: 32px 0; color: var(--fg-secondary); }
.hunt__empty p { margin: 0 0 12px; font-size: 1.125rem; color: var(--fg-primary); }

.calm { padding: clamp(40px, 6vw, 80px) 0; max-width: var(--container-max-prose); color: var(--fg-secondary); }
.calm__big { margin: 0 0 12px; font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 600; letter-spacing: -0.03em; color: var(--fg-primary); }

@media (max-width: 640px) {
  .hunt__strip { column-gap: 14px; }
  .hunt__strip > * + *::before { display: none; }
  .hunt__time { margin-left: 0; flex-basis: 100%; }
  .hunt__count { margin-left: 0; }
  .hunt__cell { padding-left: 0; padding-right: 0; }
}
</style>
