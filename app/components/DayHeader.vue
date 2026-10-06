<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

// A past day's heading in the archive: the date set large, then the same
// ruled strip as the home page.
defineProps<{ day: DayView; level?: 1 | 2; errorsHref?: string }>()
</script>

<template>
  <header class="day">
    <component :is="level === 1 ? 'h1' : 'h2'" class="day__date">{{ formatDay(day.date) }}</component>
    <DayStrip :day="day" :errors-href="errorsHref" />
  </header>
</template>

<style scoped>
.day { padding: clamp(32px, 5vw, 64px) 0 clamp(24px, 3vw, 40px); }
.day__date { margin: 0 0 clamp(20px, 3vw, 32px); font-size: clamp(2.25rem, 6vw, 4.75rem); line-height: 0.95; font-weight: 600; letter-spacing: -0.045em; }
.day__date::first-letter { text-transform: uppercase; }
</style>
