<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

// A past day's heading in the archive: the date set large, then the same
// ruled strip as the home page.
defineProps<{ day: DayView; level?: 1 | 2; errorsHref?: string }>()
const { locale } = useLang()
</script>

<template>
  <header class="day">
    <component :is="level === 1 ? 'h1' : 'h2'" class="day__date">{{ formatDay(day.date, locale) }}</component>
    <DayStrip :day="day" :errors-href="errorsHref" />
  </header>
</template>

<style scoped>
.day { padding: clamp(20px, 3vw, 36px) 0 clamp(8px, 1vw, 12px); }
.day__date { margin: 0 0 clamp(10px, 1.5vw, 16px); font-size: clamp(1.75rem, 3.5vw, 2.75rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.day__date::first-letter { text-transform: uppercase; }
</style>
