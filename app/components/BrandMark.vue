<script setup lang="ts">
// The barato.si mark: a percent sign built from two perfect circles and a 45°
// bar (brand/mark.svg, concept 2 "Vectorial"). The ink parts follow currentColor,
// so it works on paper and at night; the lower circle is always the brand cobalt
// (--brand-cobalt), as in the logo's own dark version. Decorative: the wordmark
// next to it is the accessible name.
withDefaults(defineProps<{ size?: number | string }>(), { size: '1em' })
</script>

<template>
  <svg class="bm" :width="size" :height="size" viewBox="26 26 148 148" aria-hidden="true" focusable="false">
    <circle cx="62" cy="62" r="30" />
    <path d="M150 26 L174 50 L50 174 L26 150 Z" />
    <circle class="bm__accent" cx="138" cy="138" r="30" />
  </svg>
</template>

<style scoped>
.bm { display: inline-block; flex: none; fill: currentColor; }
.bm__accent { fill: var(--brand-cobalt); }
</style>
