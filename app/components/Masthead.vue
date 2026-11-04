<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

// The home page nameplate. The name is the pun: barato.si reads "barato, sí",
// and the full stop is the mark. Small enough that the evidence below is in the
// first screen.
defineProps<{ day: DayView | null | undefined }>()
const { t } = useLang()
</script>

<template>
  <header class="mast">
    <div class="mast__plate">
      <h1 class="mast__name">barato, sí<span class="mast__dot" aria-hidden="true">.</span></h1>
      <p class="mast__lede">{{ t.masthead.lede }}</p>
    </div>
    <DayStrip v-if="day" :day="day" show-date />
  </header>
</template>

<style scoped>
.mast { padding: clamp(16px, 2.5vw, 28px) 0 0; }
.mast__plate { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px 32px; padding-bottom: clamp(10px, 1.5vw, 16px); }
.mast__name { margin: 0 0 0 -0.03em; font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 0.95; font-weight: 700; letter-spacing: -0.05em; color: var(--fg-primary); }
.mast__dot { color: var(--accent-lead); }
.mast__lede { margin: 0; max-width: 34ch; font-size: clamp(0.9375rem, 1.3vw, 1.0625rem); line-height: 1.35; color: var(--fg-secondary); }
</style>
