<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

const props = defineProps<{ deal: DealView; now: number }>()
// The one exclamation on the page lives here, on the lead, never on every row.
const label = computed(() => (props.deal.flag === 'chollo' ? '¡Baratísimo!' : FLAG_LABEL[props.deal.flag]))
</script>

<template>
  <section class="lead" aria-labelledby="lead-title">
    <p class="eyebrow">La mejor de hoy</p>
    <div class="lead__grid">
      <div class="lead__visual">
        <a class="lead__pic" :href="linkFor(deal)" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
          <DealImage :src="deal.image" :alt="deal.title" :mark="storeMark(deal)" wide eager />
        </a>
        <DealPrice
          lead
          :price="deal.price" :list-price="deal.listPrice" :currency="deal.currency" :discount-pct="deal.discountPct"
        />
      </div>
      <div class="lead__text">
        <p v-if="label" class="flag" :class="`flag--${FLAG_QUERY[deal.flag] ?? deal.flag}`">{{ label }}</p>
        <h2 id="lead-title" class="lead__title">
          <a :href="linkFor(deal)" rel="noopener" target="_blank">{{ deal.title }}</a>
        </h2>
        <DealMeta :deal="deal" :now="now" />
        <a class="lead__go" :href="linkFor(deal)" rel="noopener" target="_blank">
          Ver en {{ deal.store }}<span class="sr-only"> (abre {{ hostOf(linkFor(deal)) }})</span> <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lead { padding: clamp(32px, 5vw, 64px) 0; border-top: 2px solid var(--fg-primary); }
.lead__grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 32px clamp(32px, 5vw, 80px); align-items: end; }
.lead__text { display: grid; gap: 14px; }
.lead__text .flag { margin: 0; }
.lead__visual { display: grid; gap: clamp(20px, 3vw, 32px); min-width: 0; }
.lead__pic { display: block; }
.lead__title { margin: 0; font-size: clamp(1.375rem, 2.4vw, 1.875rem); line-height: 1.2; font-weight: 600; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.lead__title a { color: var(--fg-primary); text-decoration: none; }
.lead__title a:hover { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
.lead__go {
  justify-self: start; margin-top: 6px; padding: 12px 18px; background: var(--accent-lead); color: var(--accent-lead-foreground);
  font-weight: 600; font-size: 0.9375rem; text-decoration: none;
}
.lead__go:hover { background: var(--fg-primary); }
@media (max-width: 860px) { .lead__grid { grid-template-columns: 1fr; align-items: start; } }
</style>
