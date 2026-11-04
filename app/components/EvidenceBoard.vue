<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// The top of the page: every price-error candidate shown, strongest evidence
// first. With no candidates it says so in one line and the page moves on.
withDefaults(defineProps<{ deals: DealView[]; total?: number; level?: 2 | 3; more?: boolean }>(), { total: 0, level: 2, more: true })
const { t, lp } = useLang()
</script>

<template>
  <section id="errores" class="ev" aria-labelledby="ev-title">
    <div class="ev__head">
      <component :is="level === 3 ? 'h3' : 'h2'" id="ev-title" class="ev__title">{{ t.board.title }}</component>
      <p v-if="deals.length" class="ev__count">{{ Math.max(total, deals.length) }}</p>
    </div>
    <template v-if="deals.length">
      <p class="ev__note">{{ t.board.note }}</p>
      <ol class="ev__items">
        <li v-for="d in deals" :key="d.id"><EvidenceRow :deal="d" :heading-level="level === 3 ? 4 : 3" /></li>
      </ol>
      <p v-if="more" class="ev__more">
        <NuxtLink :to="lp('/errores')">{{ t.board.more }} <span aria-hidden="true">&rarr;</span></NuxtLink>
      </p>
    </template>
    <p v-else class="ev__calm">{{ t.board.calm }}</p>
  </section>
</template>

<style scoped>
.ev { padding: clamp(20px, 3vw, 32px) 0 clamp(20px, 3vw, 32px); }
.ev__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.ev__title { margin: 0; font-size: clamp(1.375rem, 2.4vw, 1.75rem); letter-spacing: -0.025em; font-weight: 600; }
.ev__count { margin: 0; font-family: var(--font-mono); font-size: 0.875rem; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
.ev__note { margin: 6px 0 16px; max-width: var(--container-max-prose); font-size: 0.875rem; color: var(--fg-secondary); }
.ev__calm { margin: 6px 0 0; font-size: 0.9375rem; color: var(--fg-secondary); }
.ev__items { margin: 0; padding: 0; list-style: none; border-bottom: 1px solid var(--border); }
.ev__more { margin: 14px 0 0; font-size: 0.875rem; }
.ev__more a { font-weight: 600; text-decoration: none; }
.ev__more a:hover { text-decoration: underline; text-underline-offset: 3px; }
</style>
