<script setup lang="ts">
// How likely a price is a mistake, 0-100: the number in mono and a thin ruled
// bar filled to scale. Typographic, never a badge.
const props = defineProps<{ value: number }>()
const v = computed(() => Math.round(Math.max(0, Math.min(100, Number.isFinite(props.value) ? props.value : 0))))
const level = computed(() => (v.value >= 70 ? 'alta' : v.value >= 55 ? 'media' : 'baja'))
</script>

<template>
  <div
    class="meter" :class="`meter--${level}`" role="meter" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="v"
    :aria-valuetext="`Sospecha ${v} de 100`" aria-label="Sospecha de error de precio"
  >
    <span class="meter__label" aria-hidden="true">Sospecha</span>
    <span class="meter__num" aria-hidden="true">{{ v }}<span class="meter__of">/100</span></span>
    <span class="meter__bar" aria-hidden="true"><span class="meter__fill" :style="{ width: `${v}%` }" /></span>
  </div>
</template>

<style scoped>
.meter { display: grid; grid-template-columns: auto 1fr; align-items: baseline; gap: 4px 12px; }
.meter__label { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-secondary); }
.meter__num { justify-self: end; font-family: var(--font-mono); font-size: 1.375rem; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--fg-primary); }
.meter--alta .meter__num { color: var(--accent-lead); }
.meter__of { font-size: 0.75rem; font-weight: 400; color: var(--fg-muted); }
.meter__bar { grid-column: 1 / -1; position: relative; height: 3px; border-bottom: 1px solid var(--border-strong); }
.meter__fill { position: absolute; left: 0; bottom: -1px; height: 3px; background: var(--fg-primary); }
.meter--alta .meter__fill { background: var(--accent-lead); }
</style>
