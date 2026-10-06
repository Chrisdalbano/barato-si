<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// The review grid: ruled cells, one deal each. An <ol> so the order is the
// ranking. Only the first 12 cells settle in (CSS, no JS per card); the rest
// are skipped by the browser until they come near the viewport.
defineProps<{ deals: DealView[]; ranks: Map<string, number>; now: number }>()
</script>

<template>
  <div class="grid">
    <ol class="grid__cells">
      <li v-for="(d, i) in deals" :key="d.id" class="grid__cell" :style="i < 12 ? { '--i': i } : undefined">
        <DealCard :deal="d" :rank="ranks.get(d.id) ?? i + 1" :now="now" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* Ruled cells: every cell draws its top and left rule; the wrapper clips the
   left-most rules so the grid sits flush with the page edge like a table. */
.grid { overflow: hidden; border-bottom: 1px solid var(--border); }
.grid__cells {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  margin: 0 0 0 -1px; padding: 0; list-style: none;
}
.grid__cell {
  border-top: 1px solid var(--border); border-left: 1px solid var(--border); min-width: 0;
  content-visibility: auto; contain-intrinsic-size: auto 420px;
}
.grid__cell:nth-child(-n + 12) { animation: settle 520ms cubic-bezier(0.22, 1, 0.36, 1) backwards; animation-delay: calc(var(--i, 0) * 35ms + 120ms); }
/* Transform only: paused animations (background tabs, bots) leave cells readable. */
@keyframes settle { from { transform: translateY(12px); } }
@media (prefers-reduced-motion: reduce) { .grid__cell { animation: none !important; } }
@media (max-width: 540px) {
  .grid__cells { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
