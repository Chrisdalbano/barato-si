<script setup lang="ts">
import { AnimatePresence, MotionConfig, motion } from 'motion-v'
import type { DealView } from '~/composables/useDeals'
import { SORTS } from '~/composables/useDealFilters'

const props = defineProps<{ deals: DealView[]; generatedAt: string; leadId?: string; shownAbove?: string[] }>()

const deals = computed(() => props.deals)
const f = useDealFilters(deals)

// Rank is the deal's place in the day's file order (the editorial ranking), whatever the current sort.
const rank = computed(() => new Map(props.deals.map((d, i) => [d.id, i + 1])))

// The lead and the price-error section are already on the page above; drop
// them from the default view only. Any filter shows the full matching set.
const above = computed(() => new Set([props.leadId, ...(props.shownAbove ?? [])].filter(Boolean)))
const shown = computed(() => (f.active.value || !above.value.size ? f.results.value : f.results.value.filter(d => !above.value.has(d.id))))

// "hace 3 horas" is measured from generation time in the prerendered HTML,
// then from the reader's clock once the page is live.
const now = ref(Date.parse(props.generatedAt) || 0)
onMounted(() => { now.value = Date.now() })

// Local copy of the search box so typing is not a router navigation per key.
const search = ref('')
watch(f.text, (v) => { if (v !== search.value.trim()) search.value = v }, { immediate: true })
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => f.set({ q: v.trim() || null }), 220)
})

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1]
</script>

<template>
  <section class="list" aria-labelledby="list-title">
    <div class="list__head">
      <h2 id="list-title" class="list__title">Todas las ofertas</h2>
      <p class="list__count" aria-live="polite">
        {{ f.results.value.length }} de {{ deals.length }}
      </p>
    </div>

    <form class="filters" role="search" @submit.prevent>
      <!-- Only filters with something behind them: no zero options, no one-item lists. -->
      <fieldset v-if="f.flags.value.length" class="filters__group">
        <legend>Tipo</legend>
        <button type="button" class="seg" :aria-pressed="!f.flag.value" @click="f.set({ tipo: null })">Todas</button>
        <button
          v-for="o in f.flags.value" :key="o.flag" type="button" class="seg"
          :aria-pressed="f.flag.value === o.flag" @click="f.set({ tipo: o.query })"
        >{{ o.label }} <span class="seg__n">{{ o.count }}</span></button>
      </fieldset>

      <label v-if="f.stores.value.length > 1" class="filters__field">
        <span>Tienda</span>
        <select :value="f.store.value" @change="f.set({ tienda: ($event.target as HTMLSelectElement).value || null })">
          <option value="">Todas ({{ f.stores.value.length }})</option>
          <option v-for="[name, n] in f.stores.value" :key="name" :value="name">{{ name }} ({{ n }})</option>
        </select>
      </label>

      <label v-if="f.categories.value.length > 1" class="filters__field">
        <span>Categoría</span>
        <select :value="f.category.value" @change="f.set({ cat: ($event.target as HTMLSelectElement).value || null })">
          <option value="">Todas ({{ f.categories.value.length }})</option>
          <option v-for="[name, n] in f.categories.value" :key="name" :value="name">{{ name }} ({{ n }})</option>
        </select>
      </label>

      <label v-if="f.mins.value.length > 1" class="filters__field">
        <span>Descuento mínimo</span>
        <select :value="String(f.min.value)" @change="f.set({ min: Number(($event.target as HTMLSelectElement).value) || null })">
          <option v-for="m in f.mins.value" :key="m" :value="String(m)">{{ m ? `${m} %` : 'Cualquiera' }}</option>
        </select>
      </label>

      <label class="filters__field filters__search">
        <span>Buscar</span>
        <input v-model="search" type="search" placeholder="televisor, adidas, Steam…" autocomplete="off">
      </label>

      <fieldset class="filters__group">
        <legend>Orden</legend>
        <button
          v-for="o in SORTS" :key="o.key" type="button" class="seg"
          :aria-pressed="f.sort.value === o.key" @click="f.set({ orden: o.key })"
        >{{ o.label }}</button>
      </fieldset>
    </form>

    <MotionConfig reduced-motion="user">
      <ol class="list__items">
        <AnimatePresence :initial="false">
          <motion.li
            v-for="(d, i) in shown" :key="d.id" layout="position" class="list__item"
            :style="{ '--i': Math.min(i, 12) }"
            :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0, transition: { duration: 0.15 } }"
            :transition="{ layout: { duration: 0.45, ease }, opacity: { duration: 0.25 } }"
          >
            <DealRow :deal="d" :rank="rank.get(d.id) ?? i + 1" :now="now" />
          </motion.li>
        </AnimatePresence>
      </ol>
    </MotionConfig>

    <div v-if="!shown.length" class="list__empty">
      <template v-if="deals.length && f.active.value">
        <p>Nada con estos filtros.</p>
        <button type="button" class="seg" @click="f.reset()">Quitar filtros</button>
      </template>
      <p v-else-if="deals.length">Todo lo de este día ya está arriba.</p>
      <p v-else>Ese día no hubo nada barato de verdad.</p>
    </div>
  </section>
</template>

<style scoped>
.list { padding: clamp(32px, 5vw, 64px) 0 0; border-top: 2px solid var(--fg-primary); }
.list__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.list__title { margin: 0; font-size: clamp(1.5rem, 3vw, 2.25rem); letter-spacing: -0.03em; font-weight: 600; }
.list__count { margin: 0; font-family: var(--font-mono); font-size: 0.875rem; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }

.filters { display: flex; flex-wrap: wrap; align-items: end; gap: 16px 28px; margin: 24px 0 28px; padding: 16px 0 20px; border-bottom: 1px solid var(--border); }
.filters fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
.filters legend, .filters__field > span { display: block; margin-bottom: 6px; padding: 0; font-size: 0.75rem; color: var(--fg-secondary); }
.filters__group { display: flex; flex-wrap: wrap; }
.filters__group legend { width: 100%; }
.filters__field { display: grid; }
.filters__search { flex: 1 1 14rem; }
select, input[type="search"] {
  height: 38px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 0;
  background: var(--bg-canvas); color: var(--fg-primary); font: inherit; font-size: 0.9375rem; min-width: 0;
}
select { padding-right: 28px; max-width: 16rem; text-overflow: ellipsis; }
.seg__n { margin-left: 0.35em; font-family: var(--font-mono); font-size: 0.8125rem; opacity: 0.7; font-variant-numeric: tabular-nums; }
input[type="search"] { width: 100%; }
select:focus-visible, input:focus-visible { outline: 2px solid var(--accent-lead); outline-offset: 1px; }

.list__items { margin: 0; padding: 0; list-style: none; }
/* Settle-in on first paint: pure CSS so it works before hydration and without JS.
   fill-mode backwards leaves no transform behind for motion's layout animations. */
.list__item { animation: settle 520ms cubic-bezier(0.22, 1, 0.36, 1) backwards; animation-delay: calc(var(--i, 0) * 40ms + 120ms); }
/* Transform only: if animations are paused (background tab, screenshot bots) rows stay readable. */
@keyframes settle { from { transform: translateY(14px); } }

.list__empty { padding: 40px 0; border-top: 1px solid var(--border); color: var(--fg-secondary); }
.list__empty p { margin: 0 0 12px; font-size: 1.125rem; color: var(--fg-primary); }

@media (prefers-reduced-motion: reduce) {
  .list__item { animation: none; }
}
@media (max-width: 640px) {
  .filters { gap: 14px 16px; }
  .filters__field:not(.filters__search) { flex: 1 1 40%; }
  select { max-width: none; width: 100%; }
}
</style>
