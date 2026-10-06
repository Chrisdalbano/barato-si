<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// A price-error candidate with its evidence: picture, title, price against the
// list price, the suspicion meter, the signals behind it (strongest first),
// the model's note when there is one, and what our archive has seen.
// `wide` lays the picture beside the text (the /errores page); otherwise the
// picture sits on top (the home section's 2-3 column grid).
const props = defineProps<{ deal: DealView; wide?: boolean; headingLevel?: 2 | 3 }>()
const history = computed(() => historyLine(props.deal.history, props.deal.currency))
const ai = computed(() => (props.deal.ai?.note?.trim() ? props.deal.ai : undefined))
</script>

<template>
  <article class="ec" :class="{ 'ec--wide': wide }">
    <a class="ec__pic" :href="linkFor(deal)" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
      <DealImage :src="deal.image" :alt="deal.title" :mark="storeMark(deal)" />
    </a>
    <div class="ec__body">
      <p class="ec__kicker">
        <span class="flag flag--posible-error">{{ deal.flag === 'error-probable' ? 'Posible error de precio' : 'Sospechoso' }}</span>
        <span class="ec__store">{{ deal.store }}</span>
      </p>
      <component :is="headingLevel === 2 ? 'h2' : 'h3'" class="ec__title">
        <a :href="linkFor(deal)" rel="noopener" target="_blank">{{ deal.title }}</a>
      </component>
      <div class="ec__nums">
        <DealPrice
          class="ec__price" still
          :price="deal.price" :list-price="deal.listPrice" :currency="deal.currency" :discount-pct="deal.discountPct"
        />
        <ErrorMeter class="ec__meter" :value="deal.errorScore" />
      </div>
      <ul v-if="deal.errorSignals.length" class="ec__signals" aria-label="Señales">
        <li v-for="s in deal.errorSignals" :key="s">{{ s }}</li>
      </ul>
      <p v-if="ai" class="ec__ai">
        <span class="ec__ai-label">{{ confidenceLabel(ai.confidence) }}</span>
        {{ ai.note }}
      </p>
      <p v-if="history" class="ec__hist">{{ history.charAt(0).toUpperCase() + history.slice(1) }}.</p>
      <p class="ec__actions">
        <a class="ec__go" :href="linkFor(deal)" rel="noopener" target="_blank">
          Ver en {{ deal.store }}<span class="sr-only"> (abre {{ hostOf(linkFor(deal)) }})</span> <span aria-hidden="true">&rarr;</span>
        </a>
        <a class="ec__via" :href="deal.sourceUrl" rel="noopener" target="_blank">vía {{ sourceName(deal.source) }}</a>
      </p>
    </div>
  </article>
</template>

<style scoped>
.ec { display: grid; grid-template-rows: auto 1fr; height: 100%; }
.ec__pic { display: block; }
.ec__body { display: grid; align-content: start; gap: 12px; padding: 16px 18px 20px; min-width: 0; }
.ec__body > p { margin: 0; }
.ec__kicker { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; }
.ec__kicker .flag { margin: 0; }
.ec__store { font-size: 0.8125rem; font-weight: 500; color: var(--fg-primary); }
.ec__title { margin: 0; font-size: 1.0625rem; line-height: 1.35; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.ec__title a { color: var(--fg-primary); text-decoration: none; }
.ec__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.ec__nums { display: grid; grid-template-columns: minmax(0, 1fr) minmax(8rem, 11rem); gap: 12px 20px; align-items: end; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.ec .ec__price { justify-content: flex-start; }
.ec__signals { margin: 0; padding: 0; list-style: none; font-size: 0.875rem; color: var(--fg-primary); }
.ec__signals li { padding: 6px 0; border-bottom: 1px solid var(--border); }
.ec__signals li:first-child { font-weight: 500; }
.ec__ai { font-size: 0.875rem; color: var(--fg-secondary); }
.ec__ai-label { display: block; margin-bottom: 2px; font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-muted); }
.ec__hist { font-size: 0.8125rem; color: var(--fg-secondary); }
.ec__actions { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 20px; padding-top: 4px; }
.ec__go { padding: 10px 14px; background: var(--accent-lead); color: var(--accent-lead-foreground); font-weight: 600; font-size: 0.875rem; text-decoration: none; }
.ec__go:hover { background: var(--fg-primary); }
.ec__via { font-size: 0.8125rem; color: var(--fg-secondary); text-underline-offset: 2px; }
.ec__via:hover { color: var(--link-fg); }

.ec--wide { grid-template-rows: none; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
.ec--wide .ec__pic { align-self: start; }
.ec--wide .ec__body { padding: 0 0 0 clamp(16px, 2.4vw, 28px); }
@media (max-width: 640px) {
  .ec--wide { grid-template-columns: 1fr; }
  .ec--wide .ec__body { padding: 14px 0 0; }
  .ec__nums { grid-template-columns: 1fr; }
}
</style>
