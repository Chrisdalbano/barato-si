<script setup lang="ts">
import type { DealFilters } from '~/composables/useDealFilters'

// Every facet. A persistent side panel on desktop, the same DOM as a drawer on
// phones (DealExplorer positions it). Counts respect the other selections, and
// a group appears only when it has something behind it.
const props = defineProps<{ f: DealFilters; resultCount: number }>()
const emit = defineEmits<{ close: [] }>()
const { locale, t } = useLang()

const state = computed(() => props.f.state.value)
const o = computed(() => props.f.options.value)
const FACET_LIMIT = 8

const showAllStores = ref(false)
const showAllBrands = ref(false)
const clip = (rows: [string, number][], all: boolean, selected: string[]) =>
  (all ? rows : rows.filter((r, i) => i < FACET_LIMIT || selected.includes(r[0])))
const storeRows = computed(() => clip(o.value.stores, showAllStores.value, state.value.stores))
const brandRows = computed(() => clip(o.value.brands, showAllBrands.value, state.value.brands))

// Local copies, so typing a price is not a navigation per key.
const priceMin = ref('')
const priceMax = ref('')
watch(() => state.value.priceMin, (v) => { priceMin.value = v === null ? '' : String(v) }, { immediate: true })
watch(() => state.value.max, (v) => { priceMax.value = v === null ? '' : String(v) }, { immediate: true })
let timer: ReturnType<typeof setTimeout> | undefined
function pushPrices() {
  clearTimeout(timer)
  timer = setTimeout(() => props.f.set({ desde: priceMin.value.trim() || null, max: priceMax.value.trim() || null }), 300)
}
onUnmounted(() => clearTimeout(timer))

const countActive = computed(() => props.f.items.value.length)
const hasScope = computed(() => o.value.showFresh || state.value.fresh || o.value.staffCount > 0 || state.value.staff
  || o.value.corroboratedCount > 0 || state.value.corroborated || o.value.gamesCount > 0)
</script>

<template>
  <form class="fp" :aria-label="t.panel.title" @submit.prevent="emit('close')">
    <header class="fp__head">
      <h3>{{ t.panel.title }}<span v-if="countActive" class="fp__n"> · {{ t.panel.active(countActive) }}</span></h3>
      <button type="button" class="fp__close" @click="emit('close')">{{ t.panel.close }}</button>
    </header>

    <div class="fp__body">
      <fieldset v-if="o.categories.length > 1 || state.category" class="fp__group">
        <legend>{{ t.panel.category }}</legend>
        <label class="fc">
          <input type="radio" name="fp-cat" :checked="!state.category" @change="f.set({ cat: null })">
          <span class="fc__name">{{ t.panel.all }}</span>
        </label>
        <label v-for="[name, n] in o.categories" :key="name" class="fc">
          <input type="radio" name="fp-cat" :checked="state.category === name" @change="f.set({ cat: name })">
          <span class="fc__name">{{ categoryLabel(name, locale) }}</span><span class="fc__n">{{ n }}</span>
        </label>
      </fieldset>

      <fieldset v-if="o.brands.length" class="fp__group">
        <legend>{{ t.panel.brand }}</legend>
        <label v-for="[name, n] in brandRows" :key="name" class="fc">
          <input type="checkbox" :checked="state.brands.includes(name)" @change="f.toggleIn('marca', state.brands, name)">
          <span class="fc__name">{{ name }}</span><span class="fc__n">{{ n }}</span>
        </label>
        <button v-if="o.brands.length > FACET_LIMIT" type="button" class="fp__more" @click="showAllBrands = !showAllBrands">
          {{ showAllBrands ? t.panel.seeLess : t.panel.seeAll(o.brands.length) }}
        </button>
      </fieldset>

      <fieldset v-if="o.stores.length > 1 || state.stores.length" class="fp__group">
        <legend>{{ t.panel.store }}</legend>
        <label v-for="[name, n] in storeRows" :key="name" class="fc">
          <input type="checkbox" :checked="state.stores.includes(name)" @change="f.toggleIn('tienda', state.stores, name)">
          <span class="fc__name">{{ name }}</span><span class="fc__n">{{ n }}</span>
        </label>
        <button v-if="o.stores.length > FACET_LIMIT" type="button" class="fp__more" @click="showAllStores = !showAllStores">
          {{ showAllStores ? t.panel.seeLess : t.panel.seeAll(o.stores.length) }}
        </button>
      </fieldset>

      <fieldset class="fp__group">
        <legend>{{ t.panel.price }}</legend>
        <div class="fp__prices">
          <label>
            <span>{{ t.panel.from }}</span>
            <input v-model="priceMin" class="field" type="number" min="0" step="any" inputmode="decimal" placeholder="0" @input="pushPrices">
          </label>
          <label>
            <span>{{ t.panel.to }}</span>
            <input v-model="priceMax" class="field" type="number" min="0" step="any" inputmode="decimal" :placeholder="t.panel.noLimit" list="fp-maxes" @input="pushPrices">
            <datalist id="fp-maxes"><option v-for="m in o.maxes" :key="m" :value="m" /></datalist>
          </label>
        </div>
        <small class="fp__hint">{{ t.panel.priceHint }}</small>
      </fieldset>

      <fieldset v-if="o.minFacet.length" class="fp__group">
        <legend>{{ t.panel.minDepth }}</legend>
        <div class="fp__seg">
          <button type="button" class="seg" :aria-pressed="!state.min" @click="f.set({ min: null })">{{ t.panel.anyF }}</button>
          <button
            v-for="m in o.minFacet" :key="m.level" type="button" class="seg" :aria-pressed="state.min === m.level"
            @click="f.set({ min: m.level })"
          >{{ locale === 'en' ? `${m.level}%` : `${m.level} %` }}<span class="seg__n">{{ m.count }}</span></button>
        </div>
      </fieldset>

      <fieldset v-if="o.evidence.length > 1 || state.evidence.length" class="fp__group">
        <legend>{{ t.panel.evidence }}</legend>
        <label v-for="e in o.evidence" :key="e.key" class="fc" :class="`fc--${e.strength}`">
          <input type="checkbox" :checked="state.evidence.includes(e.key)" @change="f.toggleIn('evidencia', state.evidence, e.key)">
          <span class="fc__name">{{ e.label }}</span><span class="fc__n">{{ e.count }}</span>
        </label>
      </fieldset>

      <fieldset v-if="o.interests.length" class="fp__group">
        <legend>{{ t.panel.minInterest }}</legend>
        <div class="fp__seg">
          <button type="button" class="seg" :aria-pressed="!state.interest" @click="f.set({ interes: null })">{{ t.panel.anyM }}</button>
          <button
            v-for="m in o.interests" :key="m.level" type="button" class="seg" :aria-pressed="state.interest === m.level"
            @click="f.set({ interes: m.level })"
          >{{ m.level }}<span class="seg__n">{{ m.count }}</span></button>
        </div>
      </fieldset>

      <fieldset v-if="o.errorLevels.length" class="fp__group">
        <legend>{{ t.panel.errorLevel }}</legend>
        <div class="fp__seg">
          <button type="button" class="seg" :aria-pressed="!state.errorLevel" @click="f.set({ error: null })">{{ t.panel.anyM }}</button>
          <button
            v-for="m in o.errorLevels" :key="m.level" type="button" class="seg" :aria-pressed="state.errorLevel === m.level"
            @click="f.set({ error: m.level })"
          >{{ m.level }}+<span class="seg__n">{{ m.count }}</span></button>
        </div>
      </fieldset>

      <fieldset v-if="hasScope" class="fp__group">
        <legend>{{ t.panel.also }}</legend>
        <label v-if="o.showFresh || state.fresh" class="fc">
          <input type="checkbox" :checked="state.fresh" @change="f.set({ nuevas: state.fresh ? null : '1' })">
          <span class="fc__name">{{ t.panel.fresh }}</span><span class="fc__n">{{ o.freshCount }}</span>
        </label>
        <label v-if="o.staffCount || state.staff" class="fc">
          <input type="checkbox" :checked="state.staff" @change="f.set({ elegida: state.staff ? null : '1' })">
          <span class="fc__name">{{ t.panel.staff }}</span><span class="fc__n">{{ o.staffCount }}</span>
        </label>
        <label v-if="o.corroboratedCount || state.corroborated" class="fc">
          <input type="checkbox" :checked="state.corroborated" @change="f.set({ corroborada: state.corroborated ? null : '1' })">
          <span class="fc__name">{{ t.panel.corroborated }}</span><span class="fc__n">{{ o.corroboratedCount }}</span>
        </label>
        <label v-if="state.hideGames && o.gamesCount" class="fc">
          <input type="checkbox" :checked="state.games" @change="f.set({ juegos: state.games ? null : '1' })">
          <span class="fc__name">{{ t.panel.games }}</span><span class="fc__n">{{ o.gamesCount }}</span>
        </label>
      </fieldset>
    </div>

    <footer class="fp__foot">
      <button type="submit" class="go fp__apply">{{ t.panel.apply(resultCount) }}</button>
      <button v-if="countActive" type="button" class="seg" @click="f.reset()">{{ t.panel.reset }}</button>
    </footer>
  </form>
</template>

<style scoped>
.fp { display: flex; flex-direction: column; min-height: 0; height: 100%; font-size: 0.8125rem; }
.fp__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 0 0 8px; border-bottom: 1px solid var(--fg-primary); }
.fp__head h3 { margin: 0; font-size: 0.875rem; font-weight: 600; }
.fp__n { font-weight: 400; color: var(--fg-secondary); }
.fp__close { display: none; border: 0; background: none; padding: 4px 0; font: inherit; font-weight: 600; color: var(--link-fg); cursor: pointer; }
.fp__body { flex: 1 1 auto; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding-right: 8px; }
.fp__group { margin: 0; padding: 12px 0; border: 0; border-bottom: 1px solid var(--border); min-width: 0; }
.fp__group legend { padding: 0; float: left; width: 100%; margin-bottom: 6px; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-secondary); }
.fp__group > :not(legend) { clear: both; }

.fc { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: baseline; gap: 8px; padding: 3px 0; cursor: pointer; }
.fc:hover .fc__name { color: var(--link-fg); }
.fc input { margin: 0; accent-color: var(--accent-lead); transform: translateY(1px); }
.fc__name { overflow-wrap: anywhere; }
.fc__n { font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.fc--debil .fc__name, .fc--ninguna .fc__name { color: var(--fg-secondary); }

.fp__more { display: block; border: 0; background: none; padding: 4px 0 0; font: inherit; font-weight: 600; color: var(--link-fg); cursor: pointer; }
.fp__more:hover { text-decoration: underline; text-underline-offset: 3px; }

.fp__prices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.fp__prices span { display: block; margin-bottom: 2px; color: var(--fg-secondary); font-size: 0.75rem; }
.fp__prices .field { width: 100%; height: 32px; font-family: var(--font-mono); font-size: 0.8125rem; }
.fp__hint { display: block; margin-top: 6px; font-size: 0.6875rem; line-height: 1.35; color: var(--fg-muted); }

.fp__seg { display: flex; flex-wrap: wrap; row-gap: 4px; }
.fp__seg .seg { height: 30px; padding: 0 8px; font-size: 0.75rem; white-space: nowrap; }
.seg__n { margin-left: 0.4em; font-family: var(--font-mono); font-size: 0.6875rem; opacity: 0.7; font-variant-numeric: tabular-nums; }

.fp__foot { display: none; }

/* Same breakpoint as DealExplorer: the panel becomes a drawer. */
@media (max-width: 1100px) {
  .fp { padding: 14px 16px 0; font-size: 0.875rem; }
  .fp__close { display: block; }
  .fc { padding: 6px 0; }
  .fp__foot { display: flex; gap: 8px; padding: 12px 0 max(12px, env(safe-area-inset-bottom)); border-top: 1px solid var(--fg-primary); background: var(--bg-canvas); }
  .fp__foot .seg { height: 42px; }
  .fp__apply { flex: 1; border: 0; font: inherit; cursor: pointer; font-weight: 600; text-align: center; }
}
</style>
