<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// The line under every primary action: the source's credit, and, when the link
// does not go straight to the merchant, the host it actually passes through.
const props = defineProps<{ deal: DealView }>()
const host = computed(() => hostOf(linkFor(props.deal)))
</script>

<template>
  <span class="credit">
    <span v-if="needsCredit(deal)">vía <a :href="deal.sourceUrl" rel="noopener" target="_blank">{{ sourceName(deal.source) }}</a></span>
    <span v-if="!deal.direct && host" class="credit__hop">pasa por {{ host }}</span>
  </span>
</template>

<style scoped>
.credit { display: flex; flex-wrap: wrap; gap: 0 0.75em; font-size: 0.75rem; color: var(--fg-secondary); overflow-wrap: anywhere; }
.credit a { color: inherit; text-underline-offset: 2px; }
.credit a:hover { color: var(--link-fg); }
.credit__hop { color: var(--fg-muted); }
</style>
