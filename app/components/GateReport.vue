<script setup lang="ts">
import type { GateReport } from '~~/lib/types'

// What the interest filter kept out today, so the filter is visible. The bars
// share one scale (the largest reason) and every value is printed beside its bar.
// Offers past the publication cap are counted apart: they were not rejected on merit.
const props = defineProps<{ gate: GateReport }>()
const { locale, t } = useLang()
const n = (v: number) => formatNumber(v, locale.value)
const summary = computed(() => gateSummary(props.gate, locale.value))
const reasons = computed(() => summary.value.reasons)
const top = computed(() => reasons.value[0]?.n ?? 1)
</script>

<template>
  <section id="filtro" class="gate" aria-labelledby="gate-title">
    <h2 id="gate-title" class="gate__title">{{ t.gate.title }}</h2>
    <dl class="gate__sum">
      <div><dt>{{ t.gate.considered }}</dt><dd>{{ n(gate.considered) }}</dd></div>
      <div><dt>{{ t.gate.published }}</dt><dd>{{ n(gate.published) }}</dd></div>
      <div><dt>{{ t.gate.rejected }}</dt><dd>{{ n(summary.quality) }}</dd></div>
      <div v-if="summary.capped"><dt>{{ t.gate.capped }}</dt><dd>{{ n(summary.capped) }}</dd></div>
    </dl>
    <div v-if="reasons.length" class="gate__reasons">
      <p class="gate__lede">
        {{ t.gate.lede }}
        <template v-if="summary.capped">{{ t.gate.cappedNote }}</template>
      </p>
      <ul>
        <li v-for="r in reasons" :key="r.slug">
          <span class="gate__label">{{ r.label }}</span>
          <span class="gate__bar" aria-hidden="true"><span :style="{ width: `${(r.n / top) * 100}%` }" /></span>
          <span class="gate__n">{{ n(r.n) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.gate { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 16px clamp(24px, 4vw, 64px); margin-top: clamp(40px, 5vw, 64px); padding-top: 16px; border-top: 1px solid var(--fg-primary); }
.gate__title { grid-column: 1 / -1; margin: 0; font-size: 1.125rem; font-weight: 600; letter-spacing: -0.015em; }
.gate__sum { display: grid; gap: 0; margin: 0; align-content: start; }
.gate__sum div { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; border-bottom: 1px solid var(--border); }
.gate__sum dt { font-size: 0.8125rem; color: var(--fg-secondary); }
.gate__sum dd { margin: 0; font-family: var(--font-mono); font-size: 0.875rem; font-variant-numeric: tabular-nums; }
.gate__lede { margin: 0 0 6px; font-size: 0.8125rem; color: var(--fg-secondary); }
.gate__reasons ul { margin: 0; padding: 0; list-style: none; }
.gate__reasons li { display: grid; grid-template-columns: minmax(9rem, 14rem) minmax(0, 1fr) 4rem; gap: 12px; align-items: center; padding: 3px 0; font-size: 0.8125rem; }
.gate__bar { display: block; height: 2px; background: var(--border); }
.gate__bar span { display: block; height: 2px; background: var(--fg-secondary); }
.gate__n { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
@media (max-width: 720px) {
  .gate { grid-template-columns: 1fr; }
  .gate__reasons li { grid-template-columns: minmax(0, 1fr) 5rem 3.5rem; }
}
</style>
