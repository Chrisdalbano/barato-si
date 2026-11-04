<script setup lang="ts">
// Where today's price sits between the lowest and highest the archive saw. A
// range with a tick, not a sparkline: `history` holds a minimum and a maximum,
// no daily points, so a line would be invented. Renders nothing without a range.
const props = defineProps<{ history?: { days: number; minPrice: number; maxPrice: number }; price: number; currency: string }>()
const { locale } = useLang()
const range = computed(() => historyRange(props.history, props.price, props.currency, locale.value))
const x = computed(() => 1 + (range.value?.position ?? 0) * 58)
</script>

<template>
  <svg
    v-if="range" class="hm" width="60" height="10" viewBox="0 0 60 10" role="img" :aria-label="range.label"
  >
    <title>{{ range.label }}</title>
    <line class="hm__rail" x1="0" y1="5" x2="60" y2="5" />
    <line class="hm__end" x1="0.5" y1="2.5" x2="0.5" y2="7.5" />
    <line class="hm__end" x1="59.5" y1="2.5" x2="59.5" y2="7.5" />
    <rect class="hm__now" :x="x - 1" y="0" width="2" height="10" />
  </svg>
</template>

<style scoped>
.hm { display: block; }
.hm__rail, .hm__end { stroke: var(--border-strong); stroke-width: 1; }
.hm__now { fill: var(--fg-primary); }
</style>
