<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// The price line of a small card: today's price, the depth drawn by evidence
// strength, and the reference in one muted line.
const props = defineProps<{ deal: DealView }>()
const { locale } = useLang()
const strength = computed(() => strengthOf(props.deal))
const digits = computed(() => moneyDigits(props.deal.price, props.deal.reference?.price))
const depth = computed(() => { const v = depthOf(props.deal); return v !== null && v > 0 ? v : null })
</script>

<template>
  <div class="pp">
    <p class="pp__now">
      <strong>{{ formatPrice(deal.price, deal.currency, digits, locale) }}</strong>
      <span v-if="depth !== null" :class="`depth--${strength}`">{{ formatDiscount(depth, locale) }}</span>
    </p>
    <p class="pp__ref" :class="`evi--${strength}`">
      <template v-if="deal.reference">
        <span :class="`ref--${strength}`"><span class="ref__price">{{ formatMoney(deal.reference.price, deal.currency, digits, locale) }}</span></span>
        {{ evidenceText(evidenceOf(deal), locale).short }}
      </template>
      <template v-else>{{ evidenceText('ninguna', locale).short }}</template>
    </p>
  </div>
</template>

<style scoped>
.pp p { margin: 0; }
.pp__now { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; word-spacing: -0.35em; }
.pp__now strong { font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.02em; }
.pp__now span { font-size: 0.8125rem; }
.pp__ref { font-size: 0.6875rem; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp__ref .ref__price { font-family: var(--font-mono); margin-right: 0.25em; word-spacing: -0.35em; }
</style>
