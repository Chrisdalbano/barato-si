<script setup lang="ts">
// Don Centavo, the house tightwad: a fictional narrator whose rules are the
// site's voice. Brand fiction only. A rule never states a fact or a number
// about the world; the intro card says plainly that he does not exist.
defineProps<{ n?: number; text: string }>()
const { t } = useLang()
</script>

<template>
  <aside class="lore">
    <p class="lore__eyebrow">{{ t.lore.eyebrow }}<template v-if="n"> · {{ t.lore.rule(n) }}</template></p>
    <blockquote class="lore__text"><p>{{ text }}</p></blockquote>
    <p class="lore__sig"><span aria-hidden="true">—</span> {{ t.lore.signature }}</p>
  </aside>
</template>

<style scoped>
.lore { display: grid; grid-template-rows: auto 1fr auto; gap: 8px; height: 100%; padding: 12px 12px 10px; background: var(--fg-primary); color: var(--bg-canvas); }
.lore p { margin: 0; }
.lore__eyebrow { font-size: 0.625rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7; }
.lore__text { margin: 0; align-self: center; }
.lore__text p { font-size: 1.0625rem; line-height: 1.25; font-weight: 600; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.lore__sig { font-size: 0.75rem; font-style: italic; opacity: 0.8; }
</style>
