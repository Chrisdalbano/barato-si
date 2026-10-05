<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

// The ruled dateline under a day's title: the date, the figures that have
// something behind them (never a zero), when it was generated, and one quiet
// line of sources. A source that failed gets a short mention, not its error.
const props = defineProps<{ day: DayView; showDate?: boolean }>()

const total = computed(() => props.day.deals.length)
const bargains = computed(() => props.day.deals.filter(d => d.flag === 'chollo').length)
const errors = computed(() => props.day.deals.filter(d => d.flag === 'error-probable').length)
const sources = computed(() => sourcesLine(props.day.sources))
</script>

<template>
  <div class="strip">
    <p class="strip__line">
      <time v-if="showDate" class="strip__date" :datetime="day.date">{{ formatDay(day.date) }}</time>
      <span v-if="total" class="strip__fig">{{ plural(total, 'oferta', 'ofertas') }}</span>
      <span v-if="bargains" class="strip__fig">{{ plural(bargains, 'baratísima', 'baratísimas') }}</span>
      <a v-if="errors" class="strip__fig strip__fig--err" href="#errores">{{ plural(errors, 'posible error de precio', 'posibles errores de precio') }}</a>
      <span class="strip__time">Actualizado <time :datetime="day.generatedAt">{{ formatGenerated(day.generatedAt) }}</time></span>
    </p>
    <p v-if="sources.working || sources.quiet" class="strip__src">
      <template v-if="sources.working">Fuentes de hoy: {{ sources.working }}.</template>
      <template v-else>Hoy no respondió ninguna fuente.</template>
      <span v-if="sources.working && sources.quiet">{{ ` ${sources.quiet}` }}</span>
    </p>
  </div>
</template>

<style scoped>
.strip { border-top: 2px solid var(--fg-primary); }
.strip p { margin: 0; }
.strip__line {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 0;
  padding: 10px 0; border-bottom: 1px solid var(--fg-primary);
  font-size: 0.8125rem; font-weight: 500; font-variant-numeric: tabular-nums;
}
.strip__date { font-weight: 600; }
.strip__date::first-letter { text-transform: uppercase; }
/* Thin vertical rules between items, like a newspaper folio line. */
.strip__line > * + *::before { content: ''; display: inline-block; width: 1px; height: 0.85em; margin: 0 0.85em; background: var(--border-strong); vertical-align: -0.05em; }
.strip__fig--err { color: var(--accent-lead); font-weight: 600; text-decoration: none; }
.strip__fig--err:hover { text-decoration: underline; text-underline-offset: 3px; }
.strip__time { margin-left: auto; color: var(--fg-secondary); font-weight: 400; }
.strip__time::before { display: none !important; }
.strip__src { padding-top: 10px; font-size: 0.8125rem; color: var(--fg-secondary); }
@media (max-width: 640px) {
  /* Wrapped lines would start with a rule; use plain spacing instead. */
  .strip__line { column-gap: 14px; }
  .strip__line > * + *::before { display: none; }
  .strip__date { flex-basis: 100%; }
  .strip__time { margin-left: 0; flex-basis: 100%; }
}
</style>
