<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// One price-error candidate as a ledger line: the price, the reference, how deep
// it goes, and exactly what the reference is worth. Strength is drawn three ways
// so it survives without colour: the left rule, the reference's underline, and
// the weight of the depth figure. `full` adds every signal (the /errores page).
const props = defineProps<{ deal: DealView; full?: boolean; headingLevel?: 2 | 3 | 4 }>()

const strength = computed(() => strengthOf(props.deal))
const evidence = computed(() => EVIDENCE[evidenceOf(props.deal)])
const depth = computed(() => { const v = depthOf(props.deal); return v !== null && v > 0 ? v : null })
const digits = computed(() => moneyDigits(props.deal.price, props.deal.reference?.price))
const label = computed(() => (props.deal.flag === 'error-probable' || props.deal.errorScore >= 70 ? 'Posible error de precio' : 'Sospechoso'))
const history = computed(() => historyLine(props.deal.history, props.deal.currency))
const ai = computed(() => (props.deal.ai?.note?.trim() ? props.deal.ai : undefined))
const topSignal = computed(() => props.deal.errorSignals[0])
const sources = computed(() => (props.deal.seenIn?.length ?? 0) >= 2 ? props.deal.seenIn!.map(sourceName).join(', ') : '')
</script>

<template>
  <article class="er" :class="`er--${strength}`">
    <div class="er__grid">
      <a class="er__pic" :href="linkFor(deal)" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
        <DealImage :src="deal.image" :fallback="deal.imageFallback" :alt="deal.title" :mark="storeMark(deal)" />
      </a>

      <div class="er__head">
        <p class="er__kicker">
          <span class="flag flag--posible-error">{{ label }}</span>
          <span class="er__who">{{ whoLine(deal) }}</span>
        </p>
        <component :is="`h${headingLevel ?? 3}`" class="er__title">
          <a :href="linkFor(deal)" rel="noopener" target="_blank">{{ deal.title }}</a>
        </component>
        <p v-if="!full && topSignal" class="er__signal">{{ topSignal }}</p>
      </div>

      <dl class="er__nums">
        <div class="er__num">
          <dt>Precio</dt>
          <dd class="er__price">{{ formatPrice(deal.price, deal.currency, digits) }}</dd>
        </div>
        <div class="er__num er__num--ref">
          <dt>Referencia</dt>
          <dd v-if="deal.reference" class="er__ref" :class="`ref--${strength}`">
            <span class="ref__price">{{ formatMoney(deal.reference.price, deal.currency, digits) }}</span>
          </dd>
          <dd v-else class="er__ref er__ref--none">Ninguna</dd>
          <dd class="er__evidence" :class="`evi--${strength}`">{{ evidenceLine(deal.reference) }}</dd>
        </div>
        <div class="er__num">
          <dt>Profundidad</dt>
          <dd class="er__depth" :class="`depth--${strength}`">{{ depth !== null ? formatDiscount(depth) : '—' }}</dd>
          <dd v-if="depth !== null" class="er__against">{{ evidence.against }}</dd>
        </div>
        <div class="er__num er__num--meter">
          <dt class="sr-only">Error</dt>
          <dd><ErrorMeter :value="deal.errorScore" /></dd>
        </div>
      </dl>

      <div class="er__action">
        <a class="go" :href="linkFor(deal)" rel="noopener" target="_blank">
          Ver en {{ deal.store }}<span class="sr-only"> (abre {{ hostOf(linkFor(deal)) }})</span> <span aria-hidden="true">&rarr;</span>
        </a>
        <DealCredit :deal="deal" />
      </div>
    </div>

    <div v-if="full" class="er__more">
      <div v-if="deal.errorSignals.length">
        <h5 class="er__sub">Señales de error, de más a menos fuerte</h5>
        <ul class="er__lines">
          <li v-for="s in deal.errorSignals" :key="s">{{ s }}</li>
        </ul>
      </div>
      <div class="er__aside">
        <p v-if="ai" class="er__ai">
          <span class="er__sub">{{ confidenceLabel(ai.confidence) }}</span>
          {{ ai.note }}
        </p>
        <p v-if="history" class="er__fact">{{ history.charAt(0).toUpperCase() + history.slice(1) }}.</p>
        <p v-if="sources" class="er__fact">Visto en {{ sources }}.</p>
        <p v-if="deal.staffPick" class="er__fact">Elección editorial de la fuente.</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.er { container-type: inline-size; padding: 16px 0 16px 14px; border-top: 1px solid var(--border); border-left: 3px solid var(--accent-lead); }
.er--media { border-left: 1px solid var(--accent-lead); padding-left: 16px; }
.er--debil, .er--ninguna { border-left: 1px dashed var(--border-strong); padding-left: 16px; }

.er__grid {
  display: grid; gap: 12px 24px; align-items: start;
  grid-template-columns: 5rem minmax(0, 1fr);
  grid-template-areas: "pic head" "nums nums" "action action";
}
.er__pic { grid-area: pic; display: block; text-decoration: none; }
.er__pic :deep(.frame__mark) { font-size: 0.625rem; }
.er__head { grid-area: head; display: grid; gap: 6px; min-width: 0; }
.er__head p { margin: 0; }
.er__kicker { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }
.er__kicker .flag { margin: 0; }
.er--debil .er__kicker .flag, .er--ninguna .er__kicker .flag { color: var(--fg-secondary); }
.er__who { font-size: 0.8125rem; font-weight: 500; }
.er__title { margin: 0; font-size: 1.0625rem; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.er__title a { color: var(--fg-primary); text-decoration: none; }
.er__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.er__signal { font-size: 0.8125rem; color: var(--fg-secondary); }

.er__nums { grid-area: nums; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; margin: 0; }
.er__num { min-width: 0; }
.er__num dt { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-secondary); margin-bottom: 2px; }
.er__num dd { margin: 0; }
.er__price, .er__depth, .er__ref { word-spacing: -0.35em; }
.er__price, .er__depth { font-family: var(--font-mono); font-size: 1.375rem; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.er__ref { font-family: var(--font-mono); font-size: 1.0625rem; font-variant-numeric: tabular-nums; line-height: 1.75rem; white-space: nowrap; }
.er__ref--none { font-family: inherit; font-size: 0.875rem; color: var(--fg-muted); }
.er__evidence { font-size: 0.8125rem; line-height: 1.3; }
.er__against { font-size: 0.75rem; color: var(--fg-secondary); }
.er__num--ref { grid-column: 1 / -1; }

.er__action { grid-area: action; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }

@container (min-width: 620px) {
  .er__nums { grid-template-columns: 7.5rem minmax(0, 1.3fr) 7.5rem 8rem; }
  .er__num--ref { grid-column: auto; }
}
@container (min-width: 1080px) {
  .er__grid {
    grid-template-columns: 4.5rem minmax(14rem, 1fr) minmax(40rem, 1.8fr) 10.5rem;
    grid-template-areas: "pic head nums action";
  }
  .er__action { display: grid; justify-items: start; }
}

.er__more { display: grid; gap: 16px 32px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
@container (min-width: 760px) { .er__more { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); } }
.er__sub { display: block; margin: 0 0 4px; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-secondary); }
.er__lines { margin: 0; padding: 0; list-style: none; font-size: 0.875rem; }
.er__lines li { padding: 5px 0; border-bottom: 1px solid var(--border); }
.er__lines li:first-child { font-weight: 500; }
.er__lines li:last-child { border-bottom: 0; }
.er__aside { display: grid; gap: 8px; align-content: start; font-size: 0.8125rem; color: var(--fg-secondary); }
.er__aside p { margin: 0; }
</style>
