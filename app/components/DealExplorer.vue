<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'
import { sortLabel, sortValue } from '~/utils/filters'

// The index itself: search, sort and view above the results, the facet panel at
// the side (a drawer on phones), the active filters, then the table or the grid.
const props = defineProps<{ deals: DealView[]; generatedAt: string; shownAbove?: string[]; hideGames?: boolean; directDefault?: boolean; ads?: boolean }>()
const { locale, t } = useLang()
// The in-stream ad goes after this many rows (only on pages that ask for it).
const AD_AFTER = 12

const deals = computed(() => props.deals)
const f = useDealFilters(deals, computed(() => !!props.hideGames), computed(() => !!props.directDefault))
const state = f.state
const options = f.options

// What is already on the page above leaves the default view only. Any filter or
// sort shows the full matching set.
const above = computed(() => new Set(props.shownAbove ?? []))
const shown = computed(() => (f.active.value || !above.value.size ? f.results.value : f.results.value.filter(d => !above.value.has(d.id))))

// Up to 400 deals: render in chunks. Any change of state starts again at the first.
const CHUNK = 60
const limit = ref(CHUNK)
watch(() => JSON.stringify(state.value), () => { limit.value = CHUNK })
const visible = computed(() => shown.value.slice(0, limit.value))
const remaining = computed(() => Math.max(0, shown.value.length - limit.value))

// Ages are measured from generation time in the prerendered HTML, then from the
// reader's clock once the page is live.
const now = ref(Date.parse(props.generatedAt) || 0)
onMounted(() => { now.value = Date.now() })

// Local copy of the search box so typing is not a navigation per key.
const search = ref('')
watch(() => state.value.text, (v) => { if (v !== search.value.trim()) search.value = v }, { immediate: true })
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => f.set({ q: v.trim() || null }), 220)
})
onUnmounted(() => clearTimeout(timer))

// A column sort the control does not list still shows as the current order.
const currentSort = computed(() => sortValue(state.value))
const extraSort = computed(() => (options.value.sorts.some(o => o.value === currentSort.value) ? null : { value: currentSort.value, label: sortLabel(state.value, locale.value) }))

const middlemen = computed(() => options.value.middlemanCount)

const { open, panel, trigger, show, hide, onKeydown } = useDrawer()
</script>

<template>
  <section id="ofertas" class="ex" aria-labelledby="ex-title">
    <div class="ex__head">
      <h2 id="ex-title" class="ex__title">{{ t.explorer.title }}</h2>
      <p class="ex__count" aria-live="polite">{{ visible.length }} {{ t.explorer.of }} {{ shown.length }}</p>
    </div>

    <div class="ex__layout">
      <div v-if="open" class="ex__scrim" aria-hidden="true" @click="hide" />
      <aside
        ref="panel" class="ex__panel" :class="{ 'is-open': open }" tabindex="-1"
        :role="open ? 'dialog' : undefined" :aria-modal="open ? 'true' : undefined" :aria-label="open ? t.explorer.filters : undefined"
        @keydown="onKeydown"
      >
        <FilterPanel :f="f" :result-count="shown.length" @close="hide" />
      </aside>

      <div class="ex__main">
        <form class="bar" role="search" @submit.prevent>
          <label class="bar__search">
            <span class="sr-only">{{ t.explorer.searchSr }}</span>
            <input v-model="search" class="field" type="search" :placeholder="t.explorer.searchPh" autocomplete="off">
          </label>
          <label class="bar__sort">
            <span>{{ t.explorer.sort }}</span>
            <select class="field" :value="currentSort" @change="f.setSort(($event.target as HTMLSelectElement).value)">
              <option v-for="o in options.sorts" :key="o.value" :value="o.value">{{ o.label }}</option>
              <option v-if="extraSort" :value="extraSort.value">{{ extraSort.label }}</option>
            </select>
          </label>
          <div class="bar__view" role="group" :aria-label="t.explorer.view">
            <button type="button" class="seg" :aria-pressed="state.view === 'tabla'" @click="f.set({ vista: null })">{{ t.explorer.table }}</button>
            <button type="button" class="seg" :aria-pressed="state.view === 'cuadricula'" @click="f.set({ vista: 'cuadricula' })">{{ t.explorer.grid }}</button>
          </div>
          <button ref="trigger" type="button" class="seg bar__filters" :aria-expanded="open" @click="show">
            {{ t.explorer.filters }}<span v-if="f.items.value.length" class="bar__n"> · {{ f.items.value.length }}</span>
          </button>
        </form>

        <p v-if="middlemen > 0 || !state.direct" class="ex__direct">
          <label>
            <input type="checkbox" :checked="!state.direct" @change="f.toggleMiddlemen()">
            {{ t.explorer.middlemen }}<span v-if="middlemen" class="ex__direct-n"> ({{ middlemen }})</span>
          </label>
          <span class="ex__direct-note">{{ state.direct ? t.explorer.directNow : t.explorer.middleNote }} {{ t.explorer.confirm }}</span>
        </p>

        <ActiveFilters :items="f.items.value" @remove="f.set" @clear="f.reset" />

        <DealGrid v-if="state.view === 'cuadricula' && visible.length" :deals="visible" :now="now" :ad-after="ads ? AD_AFTER : undefined" />
        <DealTable
          v-else-if="state.view === 'tabla' && visible.length" :deals="visible" :all="deals" :now="now" :sort="state.sort" :dir="state.dir"
          :ad-after="ads ? AD_AFTER : undefined"
          @sort="f.sortBy"
        />

        <p v-if="remaining" class="ex__more">
          <button type="button" class="seg" @click="limit += CHUNK">{{ t.explorer.showMore(Math.min(CHUNK, remaining)) }}</button>
          <span class="ex__shown">{{ visible.length }} {{ t.explorer.of }} {{ shown.length }}</span>
        </p>

        <div v-if="!shown.length" class="ex__empty">
          <template v-if="deals.length && f.active.value">
            <p>{{ t.explorer.nothing }}</p>
            <button type="button" class="seg" @click="f.reset()">{{ t.explorer.reset }}</button>
          </template>
          <p v-else-if="deals.length">{{ t.explorer.noMore }}</p>
          <p v-else>{{ t.explorer.dayNothing }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ex { padding-top: clamp(20px, 3vw, 32px); border-top: 2px solid var(--fg-primary); }
.ex__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.ex__title { margin: 0; font-size: clamp(1.375rem, 2.4vw, 1.75rem); letter-spacing: -0.025em; font-weight: 600; }
.ex__count, .ex__shown { margin: 0; font-family: var(--font-mono); font-size: 0.8125rem; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }

.ex__layout { display: grid; grid-template-columns: 15.5rem minmax(0, 1fr); gap: 0 28px; align-items: start; }
.ex__panel { position: sticky; top: 8px; max-height: calc(100dvh - 16px); display: flex; flex-direction: column; outline: none; }
.ex__main { min-width: 0; }

.bar { display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px 12px; padding-bottom: 10px; }
.bar__search { flex: 1 1 14rem; min-width: 0; }
.bar__search .field { width: 100%; }
.bar__sort { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 0.75rem; color: var(--fg-secondary); }
.bar__sort select { max-width: 13.5rem; padding-right: 24px; text-overflow: ellipsis; font-size: 0.8125rem; color: var(--fg-primary); }
.bar__view { display: flex; }
.bar .seg { height: 36px; font-size: 0.8125rem; }
.bar .field { height: 36px; font-size: 0.875rem; }
.bar__filters { display: none; }
.bar__n { font-family: var(--font-mono); }

.ex__direct { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; margin: 0; padding: 0 0 8px; font-size: 0.8125rem; }
.ex__direct label { display: inline-flex; align-items: baseline; gap: 6px; cursor: pointer; font-weight: 500; }
.ex__direct input { margin: 0; accent-color: var(--accent-lead); transform: translateY(1px); }
.ex__direct-n { font-family: var(--font-mono); font-weight: 400; color: var(--fg-secondary); }
.ex__direct-note { color: var(--fg-muted); font-size: 0.75rem; }

.ex__more { display: flex; align-items: baseline; gap: 16px; margin: 20px 0 0; }
.ex__empty { padding: 32px 0; border-top: 1px solid var(--border); color: var(--fg-secondary); }
.ex__empty p { margin: 0 0 12px; font-size: 1.0625rem; color: var(--fg-primary); }

.ex__scrim { display: none; }

/* Drawer: the same panel, off to the side until asked for. */
@media (max-width: 1100px) {
  .ex__layout { grid-template-columns: minmax(0, 1fr); }
  .ex__panel {
    position: fixed; z-index: 30; top: 0; right: 0; bottom: 0; width: min(100%, 26rem); max-height: none;
    background: var(--bg-canvas); border-left: 1px solid var(--fg-primary);
    transform: translateX(100%); visibility: hidden; transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 200ms;
  }
  .ex__panel.is-open { transform: none; visibility: visible; transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
  .ex__scrim { display: block; position: fixed; z-index: 29; inset: 0; background: var(--fg-primary); opacity: 0.35; }
  .bar__filters { display: block; }
}
@media (max-width: 640px) {
  .bar__search { flex-basis: 100%; }
  .bar__sort { flex: 1 1 100%; }
  .bar__sort select { flex: 1; max-width: none; }
  .bar__view { flex: 1; }
  .bar__view .seg { flex: 1; }
  .bar__filters { flex: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .ex__panel, .ex__panel.is-open { transition: none; }
}
</style>
