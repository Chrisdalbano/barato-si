<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// The picture view: ruled cells, one deal each. Off-screen cells are skipped by
// the browser until they come near the viewport.
defineProps<{ deals: DealView[]; now: number }>()
</script>

<template>
  <div class="grid">
    <ol class="grid__cells">
      <li v-for="d in deals" :key="d.id" class="grid__cell">
        <DealCard :deal="d" :now="now" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* Ruled cells: every cell draws its top and left rule; the wrapper clips the
   left-most rules so the grid sits flush with the column edge like a table. */
.grid { overflow: hidden; border-bottom: 1px solid var(--border); }
.grid__cells {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  margin: 0 0 0 -1px; padding: 0; list-style: none;
}
.grid__cell {
  border-top: 1px solid var(--border); border-left: 1px solid var(--border); min-width: 0;
  content-visibility: auto; contain-intrinsic-size: auto 420px;
}
@media (max-width: 540px) {
  .grid__cells { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
