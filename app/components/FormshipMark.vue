<script setup lang="ts">
// The Formship icon (from Formship-Site public/brand/formship-icon-blue.svg),
// redrawn in barato's palette: one ink tone at two strengths, muted, so it
// reads as a maker's mark and not as a second brand.
withDefaults(defineProps<{ size?: number }>(), { size: 14 })
</script>

<template>
  <svg class="fm" :width="size" :height="size" viewBox="0 0 900 900" aria-hidden="true" focusable="false">
    <path d="M844.82,607.33c9.96,7.57,4.61,23.47-7.89,23.47h-116.47c-18.58.04-36.05-8.71-46.82-23.89l-114.48-160.78c-1.83-2.6-5.39-3.21-7.97-1.38-1.93,1.38-2.76,3.72-2.26,5.91.06.34,33.78,89.71,59.06,156.66,4.51,11.96-4.29,23.47-17.07,23.47h-72.71c-28.07,0-36.24-13.11-53.75-37.8,0,0-355.12-501.12-355.24-501.24-8.23-10.88-25.59-1.44-20.67,11.57,0,0,188.62,498.3,190.79,504,4.29,11.35-4.08,23.49-16.2,23.49-41.54,0-119.99-.02-120.01-.02-24.12-.59-47.66-12.18-62.68-33.41-8.62-12.16-13.35-25.94-14.41-39.79L50,114.88c.55-17.03,8.78-33.62,23.72-44.24.67-.47,1.34-.93,2.01-1.36,4.17-2.72,8.6-4.79,13.15-6.29,17.58-5.74,36.97-2.44,51.68,8.79l.02-.02,704.23,535.57Z" />
    <path class="fm__base" d="M760.3,786.91v15.18c0,20.81-16.85,37.7-37.66,37.7H247.42c-35.38,0-64.08-65.85-64.08-101.28,0-19.65,15.53-37.19,34.63-37.19.81,0,1.61.04,2.44.1l492.42,37.98c26.62,2.03,47.47,21.27,47.47,47.52Z" />
  </svg>
</template>

<style scoped>
.fm { display: inline-block; vertical-align: -0.15em; fill: currentColor; }
.fm__base { opacity: 0.45; }
</style>
