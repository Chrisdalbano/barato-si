<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

// The home page nameplate. The name is the pun: barato.si reads "barato, sí",
// and the cobalt full stop is the mark (same as the OG image and favicon).
defineProps<{ day: DayView | null | undefined }>()
</script>

<template>
  <header class="mast">
    <h1 class="mast__name">
      barato, sí<span class="mast__dot" aria-hidden="true">.</span>
    </h1>
    <p class="mast__lede">
      Las mayores rebajas del día, ordenadas por cuánto bajan de verdad. Un índice de precios, no una tienda.
    </p>
    <DayStrip v-if="day" :day="day" show-date />
  </header>
</template>

<style scoped>
.mast { padding: clamp(36px, 6vw, 88px) 0 clamp(28px, 4vw, 48px); }
.mast__name {
  margin: 0; font-size: clamp(3.5rem, 19vw, 12.5rem); line-height: 0.86; font-weight: 700;
  letter-spacing: -0.055em; color: var(--fg-primary);
  /* Optical: pull the bowl of the b onto the gutter line. */
  margin-left: -0.04em;
}
.mast__dot { color: var(--accent-lead); }
.mast__lede {
  margin: clamp(18px, 2.4vw, 32px) 0 clamp(28px, 4vw, 48px); max-width: 40ch;
  font-size: clamp(1.125rem, 2vw, 1.5rem); line-height: 1.35; letter-spacing: -0.01em; color: var(--fg-secondary);
}
</style>
