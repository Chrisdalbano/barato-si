<script setup lang="ts">
// "¿espera o compra?" on a deal, when the /si model has a verdict for it.
// Renders nothing for "aprendiendo" or without oracle data on the page.
const props = defineProps<{ dealId: string }>()
const pick = useOraclePick(() => props.dealId)
const { locale, t, lp } = useLang()
const share = computed(() => (pick.value ? formatShare(pick.value.pDrop, locale.value) : ''))
</script>

<template>
  <NuxtLink
    v-if="pick" :to="lp('/si')" class="ob" :class="`ob--${pick.verdict}`"
    :title="t.oracleBadge.title(share, pick.horizonDays)"
  >
    <span class="ob__q">{{ t.oracleBadge.lead }}</span>
    <span class="ob__v">{{ t.si.verdicts[pick.verdict] }}</span>
    <span class="ob__p">{{ share }}</span>
    <span class="sr-only">. {{ t.oracleBadge.title(share, pick.horizonDays) }}</span>
  </NuxtLink>
</template>

<style scoped>
.ob { display: inline-flex; align-items: baseline; gap: 0.4em; width: max-content; max-width: 100%; font-size: 0.6875rem; line-height: 1.2; color: var(--fg-secondary); text-decoration: none; border-bottom: 1px dotted var(--border-strong); padding-bottom: 1px; }
.ob:hover { color: var(--link-fg); border-bottom-color: currentColor; }
.ob__q { color: var(--fg-muted); }
.ob__v { font-weight: 600; letter-spacing: 0.04em; text-transform: lowercase; color: var(--fg-primary); }
.ob--espera .ob__v { color: var(--accent-lead); }
.ob__p { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--fg-muted); }
</style>
