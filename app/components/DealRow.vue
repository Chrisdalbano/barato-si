<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

defineProps<{ deal: DealView; rank: number; now: number }>()
</script>

<template>
  <article class="row">
    <span class="row__rank" :title="`Puesto ${rank} por puntuación`">{{ String(rank).padStart(2, '0') }}</span>
    <div class="row__body">
      <p v-if="FLAG_LABEL[deal.flag]" class="flag" :class="`flag--${deal.flag}`">{{ FLAG_LABEL[deal.flag] }}</p>
      <h3 class="row__title">
        <a :href="deal.url" rel="noopener" target="_blank">{{ deal.title }}</a>
      </h3>
      <DealMeta :deal="deal" :now="now" />
    </div>
    <div class="row__side">
      <DealPrice :price="deal.price" :list-price="deal.listPrice" :currency="deal.currency" :discount-pct="deal.discountPct" />
      <a class="row__go" :href="deal.url" rel="noopener" target="_blank">
        Ver oferta<span class="sr-only"> (abre {{ hostOf(deal.url) }})</span> <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  </article>
</template>

<style scoped>
.row {
  display: grid; grid-template-columns: 3.25rem minmax(0, 1fr) minmax(11rem, auto);
  gap: 8px 24px; padding: 22px 0; border-top: 1px solid var(--border);
}
.row__rank { font-family: var(--font-mono); font-size: 0.875rem; color: var(--fg-muted); padding-top: 3px; font-variant-numeric: tabular-nums; }
.row__body { display: grid; gap: 8px; align-content: start; min-width: 0; }
.row__body .flag { margin: 0; }
.row__title { margin: 0; font-size: 1.0625rem; line-height: 1.35; font-weight: 500; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.row__title a { color: var(--fg-primary); text-decoration: none; }
.row__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.row__side { display: grid; justify-items: end; align-content: start; gap: 10px; text-align: right; }
.row__go { font-size: 0.8125rem; font-weight: 500; color: var(--link-fg); text-decoration: none; white-space: nowrap; }
.row__go:hover { text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 640px) {
  .row { grid-template-columns: 2.25rem minmax(0, 1fr); padding: 18px 0; }
  .row__side { grid-column: 2; justify-items: start; text-align: left; grid-auto-flow: column; justify-content: space-between; align-items: baseline; }
  .row__side :deep(.price) { justify-content: flex-start; }
}
</style>
