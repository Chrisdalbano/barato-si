<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'
import { dealAnchor } from '~~/lib/landing'

// One cell of the grid: picture, title, the price against its reference with the
// evidence named, and the way out. Same honesty as the table, more picture.
const props = defineProps<{ deal: DealView; now: number }>()
const strength = computed(() => strengthOf(props.deal))
const digits = computed(() => moneyDigits(props.deal.price, props.deal.reference?.price))
const depth = computed(() => { const v = depthOf(props.deal); return v !== null && v > 0 ? v : null })
const { locale, t } = useLang()
const out = useOutbound()
const href = computed(() => out.href(props.deal))
const rel = computed(() => out.rel(props.deal))
const landing = useLandingLinks()
const catHref = computed(() => landing.categoryHref(props.deal))
const storeHref = computed(() => landing.storeHref(props.deal))
</script>

<template>
  <article :id="dealAnchor(deal.id)" class="card">
    <a class="card__pic" :href="href" :rel="rel" target="_blank" tabindex="-1" aria-hidden="true">
      <DealImage :src="deal.image" :fallback="deal.imageFallback" :alt="deal.title" :mark="storeMark(deal)" />
    </a>
    <div class="card__body">
      <p class="card__line">
        <span class="card__who">
          <template v-if="deal.brand && deal.brand.toLocaleLowerCase('en') !== deal.store.toLocaleLowerCase('en')">{{ deal.brand }} · </template>
          <NuxtLink v-if="storeHref" :to="storeHref" class="card__tax">{{ deal.store }}</NuxtLink><template v-else>{{ deal.store }}</template>
          <template v-if="catHref && deal.category"> · <NuxtLink :to="catHref" class="card__tax">{{ categoryLabel(deal.category, locale) }}</NuxtLink></template>
        </span>
        <span class="card__age"><time :datetime="deal.publishedAt">{{ formatAgeShort(deal.publishedAt, now) }}</time></span>
      </p>
      <p v-if="deal.flag === 'error-probable'" class="flag flag--posible-error card__flag">{{ flagLabel(deal.flag, locale) }}</p>
      <h3 class="card__title">
        <a :href="href" :rel="rel" target="_blank">{{ deal.title }}</a>
      </h3>
      <p class="card__price">
        <strong>{{ formatPrice(deal.price, deal.currency, digits, locale) }}</strong>
        <span v-if="depth !== null" :class="`depth--${strength}`">{{ formatDiscount(depth, locale) }}</span>
      </p>
      <p class="card__ref" :class="`evi--${strength}`">
        <template v-if="deal.reference">
          <span :class="`ref--${strength}`"><span class="ref__price">{{ formatMoney(deal.reference.price, deal.currency, digits, locale) }}</span></span>
          {{ evidenceLine(deal.reference, locale) }}
        </template>
        <template v-else>{{ evidenceLine(undefined, locale) }}</template>
      </p>
      <p class="card__oracle">
        <OracleBadge :deal-id="deal.id" />
      </p>
      <div class="card__foot">
        <a class="card__go" :href="href" :rel="rel" target="_blank">
          {{ t.seeAt(deal.store) }}<span class="sr-only">{{ t.opens(hostOf(href)) }}</span> <span aria-hidden="true">&rarr;</span>
        </a>
        <DealCredit :deal="deal" />
        <ShareDeal :deal="deal" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.card { display: grid; grid-template-rows: auto 1fr; height: 100%; }
.card__pic { display: block; text-decoration: none; }
.card__body { display: grid; grid-auto-rows: auto; align-content: start; gap: 6px; padding: 12px 14px 14px; min-width: 0; }
.card__body > p { margin: 0; }
.card__line { display: flex; justify-content: space-between; gap: 8px; font-size: 0.75rem; color: var(--fg-secondary); }
.card__who { overflow-wrap: anywhere; }
.card__tax { color: inherit; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 3px; }
.card__tax:hover { color: var(--link-fg); text-decoration-color: currentColor; }
.card { scroll-margin-top: 48px; }
.card:target, .card.is-shared { outline: 2px solid var(--brand-cobalt); outline-offset: -2px; }
.card__age { font-family: var(--font-mono); color: var(--fg-muted); white-space: nowrap; }
.card__title {
  margin: 0; font-size: 0.875rem; line-height: 1.3; font-weight: 500; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden;
}
.card__title a { color: var(--fg-primary); text-decoration: none; }
.card__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.card__price, .card__ref .ref__price { word-spacing: -0.35em; }
.card__price { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.card__price strong { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; }
.card__ref { font-size: 0.75rem; line-height: 1.3; }
.card__oracle:empty { display: none; }
.card__ref .ref__price { font-family: var(--font-mono); margin-right: 0.25em; }
.card__foot { display: grid; justify-items: start; gap: 2px; padding-top: 6px; }
.card__go { font-size: 0.8125rem; font-weight: 600; color: var(--link-fg); text-decoration: none; overflow-wrap: anywhere; }
.card__go:hover { text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 540px) {
  .card__body { padding: 10px 10px 12px; }
  .card__price strong { font-size: 1.0625rem; }
}
</style>
