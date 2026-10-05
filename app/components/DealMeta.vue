<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// Publisher facts (store, time, attribution) and barato.si's own analysis,
// kept visibly apart: the reasons and score are ours, not DealNews text.
defineProps<{ deal: DealView; now: number; hideAnalysis?: boolean }>()
</script>

<template>
  <div class="meta">
    <p class="meta__line">
      <span class="meta__store">{{ deal.store }}</span>
      <span aria-hidden="true">&middot;</span>
      <time :datetime="deal.publishedAt">{{ formatAgo(deal.publishedAt, now) }}</time>
      <span aria-hidden="true">&middot;</span>
      <span>vía <a :href="deal.sourceUrl" rel="noopener" target="_blank">{{ sourceName(deal.source) }}</a></span>
    </p>
    <div v-if="!hideAnalysis" class="meta__analysis">
      <span class="meta__label">barato.si</span>
      <span class="meta__score" :title="`Puntuación de barato.si: ${deal.score} de 100`">{{ deal.score }}/100</span>
      <span v-for="r in deal.reasons" :key="r" class="meta__reason">{{ r }}</span>
    </div>
  </div>
</template>

<style scoped>
.meta { display: grid; gap: 6px; font-size: 0.8125rem; color: var(--fg-secondary); }
.meta p { margin: 0; }
.meta__line { display: flex; flex-wrap: wrap; gap: 0 0.5em; }
.meta__store { color: var(--fg-primary); font-weight: 500; }
.meta__line a { color: inherit; text-underline-offset: 2px; }
.meta__line a:hover { color: var(--link-fg); }
.meta__analysis { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.9em; color: var(--fg-muted); }
.meta__label { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-secondary); }
.meta__score { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.meta__reason + .meta__reason::before { content: '/'; margin-right: 0.9em; color: var(--border-strong); }
</style>
