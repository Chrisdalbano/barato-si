<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

defineProps<{ deal: DealView; rank: number; now: number; hideFlag?: boolean }>()
</script>

<template>
  <article class="row">
    <span class="row__rank" :title="rank ? `Puesto ${rank} en la lista del día` : undefined">{{ rank ? String(rank).padStart(2, '0') : '' }}</span>
    <a class="row__pic" :href="linkFor(deal)" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
      <DealImage :src="deal.image" :alt="deal.title" :mark="storeMark(deal)" />
    </a>
    <div class="row__body">
      <p v-if="!hideFlag && FLAG_LABEL[deal.flag]" class="flag" :class="`flag--${FLAG_QUERY[deal.flag] ?? deal.flag}`">{{ FLAG_LABEL[deal.flag] }}</p>
      <h3 class="row__title">
        <a :href="linkFor(deal)" rel="noopener" target="_blank">{{ deal.title }}</a>
      </h3>
      <DealMeta :deal="deal" :now="now" />
    </div>
    <div class="row__side">
      <DealPrice :price="deal.price" :list-price="deal.listPrice" :currency="deal.currency" :discount-pct="deal.discountPct" />
      <a class="row__go" :href="linkFor(deal)" rel="noopener" target="_blank">
        Ver en {{ deal.store }}<span class="sr-only"> (abre {{ hostOf(linkFor(deal)) }})</span> <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  </article>
</template>

<style scoped>
.row {
  display: grid; grid-template-columns: 3.25rem 6rem minmax(0, 1fr) minmax(11rem, auto);
  gap: 8px 24px; padding: 22px 0; border-top: 1px solid var(--border);
}
.row__rank { font-family: var(--font-mono); font-size: 0.875rem; color: var(--fg-muted); padding-top: 3px; font-variant-numeric: tabular-nums; }
.row__pic { display: block; align-self: start; }
.row__pic :deep(.frame__mark) { font-size: 0.6875rem; }
.row__body { display: grid; gap: 8px; align-content: start; min-width: 0; }
.row__body .flag { margin: 0; }
.row__title { margin: 0; font-size: 1.0625rem; line-height: 1.35; font-weight: 500; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.row__title a { color: var(--fg-primary); text-decoration: none; }
.row__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.row__side { display: grid; justify-items: end; align-content: start; gap: 10px; text-align: right; }
.row__go { font-size: 0.8125rem; font-weight: 500; color: var(--link-fg); text-decoration: none; white-space: nowrap; }
.row__go:hover { text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 640px) {
  .row { grid-template-columns: 2.25rem 4.5rem minmax(0, 1fr); padding: 18px 0; }
  .row__side { grid-column: 2 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 6px 16px; text-align: left; }
  .row__go { white-space: normal; }
  .row__side :deep(.price) { justify-content: flex-start; }
}
</style>
