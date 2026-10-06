<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// One cell of the review grid: picture, flag line, title, price, then where it
// is sold and the way out. The primary link is the store; the source keeps its
// "vía" credit in the meta line.
defineProps<{ deal: DealView; rank: number; now: number }>()
</script>

<template>
  <article class="card">
    <a class="card__pic" :href="linkFor(deal)" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
      <DealImage :src="deal.image" :alt="deal.title" :mark="storeMark(deal)" />
    </a>
    <div class="card__body">
      <p class="card__line">
        <span class="card__rank" :title="`Puesto ${rank} en la lista del día`">{{ String(rank).padStart(2, '0') }}</span>
        <span v-if="FLAG_LABEL[deal.flag]" class="flag" :class="`flag--${FLAG_QUERY[deal.flag] ?? deal.flag}`">{{ FLAG_LABEL[deal.flag] }}</span>
      </p>
      <h3 class="card__title">
        <a :href="linkFor(deal)" rel="noopener" target="_blank">{{ deal.title }}</a>
      </h3>
      <DealPrice
        class="card__price" still
        :price="deal.price" :list-price="deal.listPrice" :currency="deal.currency" :discount-pct="deal.discountPct"
      />
      <div class="card__foot">
        <DealMeta :deal="deal" :now="now" hide-analysis />
        <a class="card__go" :href="linkFor(deal)" rel="noopener" target="_blank">
          Ver en {{ deal.store }}<span class="sr-only"> (abre {{ hostOf(linkFor(deal)) }})</span> <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card { display: grid; grid-template-rows: auto 1fr; height: 100%; }
.card__pic { display: block; }
.card__body { display: grid; grid-template-rows: auto auto auto 1fr; gap: 10px; padding: 14px 16px 18px; min-width: 0; }
.card__line { display: flex; align-items: baseline; gap: 12px; margin: 0; min-height: 1rem; }
.card__rank { font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.card__line .flag { margin: 0; }
.card__title {
  margin: 0; font-size: 0.9375rem; line-height: 1.35; font-weight: 500; letter-spacing: -0.005em; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
  min-height: calc(2 * 1.35em);
}
.card__title a { color: var(--fg-primary); text-decoration: none; }
.card__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.card .card__price { justify-content: flex-start; }
.card__price :deep(.price__now) { font-size: 1.5rem; }
.card__price :deep(.price__off) { font-size: 0.875rem; }
.card__foot { display: grid; gap: 8px; align-self: end; }
.card__foot :deep(.meta) { font-size: 0.75rem; }
.card__go { justify-self: start; font-size: 0.8125rem; font-weight: 600; color: var(--link-fg); text-decoration: none; }
.card__go:hover { text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 540px) {
  .card__body { padding: 12px 12px 14px; gap: 8px; }
  .card__title { font-size: 0.875rem; }
  .card__price :deep(.price__now) { font-size: 1.125rem; }
  .card__price :deep(.price__was), .card__price :deep(.price__off) { font-size: 0.75rem; }
}
</style>
