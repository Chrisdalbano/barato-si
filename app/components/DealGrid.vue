<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// The picture view: ruled cells, one deal each. Off-screen cells are skipped by
// the browser until they come near the viewport.
const props = defineProps<{ deals: DealView[]; now: number; adAfter?: number }>()
const adsOn = computed(() => !!props.adAfter && !!useRuntimeConfig().public.adsenseSlotStream)
</script>

<template>
  <div class="grid">
    <ol class="grid__cells">
      <template v-for="(d, i) in deals" :key="d.id">
        <li v-if="adsOn && i === adAfter" class="grid__ad"><AdSlot slot="stream" /></li>
        <li class="grid__cell">
          <DealCard :deal="d" :now="now" />
        </li>
      </template>
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
.grid__ad { grid-column: 1 / -1; border-top: 1px solid var(--border); border-left: 1px solid var(--border); padding: 0 14px; }
@media (max-width: 540px) {
  .grid__cells { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
