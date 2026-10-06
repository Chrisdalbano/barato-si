<script setup lang="ts">
// A product picture in a fixed-ratio frame. Sources send every shape (Steam
// capsules 231x87, GOG covers, product shots), so the image is contained on a
// surface plate, never cropped. No image, or one that fails to load, shows the
// store's domain set in mono on the same plate: no broken icon, no stock art.
const props = defineProps<{
  src: string | null
  alt: string
  mark: string
  wide?: boolean
  eager?: boolean
}>()

const failed = ref(false)
const img = ref<HTMLImageElement | null>(null)
// Intrinsic size hints for the frame ratio, so nothing shifts while loading.
const size = computed(() => (props.wide ? { w: 640, h: 360 } : { w: 400, h: 300 }))

// An image that failed before hydration fired its error event before Vue
// listened; catch that case on mount.
onMounted(() => {
  const el = img.value
  if (el && el.complete && el.naturalWidth === 0) failed.value = true
})
watch(() => props.src, () => { failed.value = false })
</script>

<template>
  <div class="frame" :class="{ 'frame--wide': wide }">
    <img
      v-if="src && !failed" ref="img" :src="src" :alt="alt" :width="size.w" :height="size.h"
      :loading="eager ? 'eager' : 'lazy'" decoding="async" referrerpolicy="no-referrer"
      @error="failed = true"
    >
    <span v-else class="frame__mark" :title="alt">{{ mark }}</span>
  </div>
</template>

<style scoped>
.frame { position: relative; display: grid; place-items: center; aspect-ratio: 4 / 3; background: var(--bg-surface); overflow: hidden; }
.frame--wide { aspect-ratio: 16 / 9; }
.frame img { width: 100%; height: 100%; object-fit: contain; padding: 6%; mix-blend-mode: multiply; }
/* Multiply melts white product backdrops into the paper plate; on night it would darken them. */
:global(html[data-variant="night"]) .frame img { mix-blend-mode: normal; }
.frame__mark {
  max-width: 88%; font-family: var(--font-mono); font-size: 0.8125rem; letter-spacing: 0.02em;
  color: var(--fg-muted); text-align: center; overflow-wrap: anywhere;
}
.frame--wide .frame__mark { font-size: clamp(0.9375rem, 1.6vw, 1.25rem); }
</style>
