<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

// The home page nameplate. The name is the pun: barato.si reads "barato, sí".
// The mark stands at cap height before it, and the full stop is drawn as one of
// the mark's perfect circles, in the same cobalt. Both are fixed em sizes, so
// nothing moves when fonts load. Small enough that the evidence below is in the
// first screen.
defineProps<{ day: DayView | null | undefined }>()
const { t } = useLang()
</script>

<template>
  <header class="mast">
    <div class="mast__plate">
      <h1 class="mast__name"><BrandMark class="mast__mark" />barato, sí<span class="mast__dot" aria-hidden="true" /></h1>
      <p class="mast__lede">{{ t.masthead.lede }}</p>
    </div>
    <DayStrip v-if="day" :day="day" show-date />
    <NextRefresh v-if="day" :generated-at="day.generatedAt" />
  </header>
</template>

<style scoped>
.mast { padding: clamp(16px, 2.5vw, 28px) 0 0; }
.mast__plate { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px 32px; padding-bottom: clamp(10px, 1.5vw, 16px); }
.mast__name { margin: 0 0 0 -0.03em; font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 0.95; font-weight: 700; letter-spacing: -0.05em; color: var(--fg-primary); }
/* Inter's cap height is ~0.73em: the mark sits on the baseline and reaches it. */
.mast__mark { width: 0.72em; height: 0.72em; margin-right: 0.2em; vertical-align: 0; }
.mast__dot { display: inline-block; width: 0.16em; height: 0.16em; margin-left: 0.05em; border-radius: 50%; background: var(--brand-cobalt); vertical-align: 0; }
.mast__lede { margin: 0; max-width: 34ch; font-size: clamp(0.9375rem, 1.3vw, 1.0625rem); line-height: 1.35; color: var(--fg-secondary); }
</style>
