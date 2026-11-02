<script setup lang="ts">
// A product picture in a fixed-ratio frame. Sources send every shape (Steam
// capsules 231x87, GOG covers, product shots), so the image is contained on a
// surface plate, never cropped. No image, or one that fails to load, shows the
// store's domain set in mono on the same plate: no broken icon, no stock art.
const props = defineProps<{
  src: string | null
  fallback?: string | null
  alt: string
  mark: string
  wide?: boolean
  eager?: boolean
}>()

// Pictures still to try, in order. A failed load or a 1x1 placeholder moves to the next.
const tried = ref(0)
const chain = computed(() => [props.src, props.fallback].filter((u): u is string => !!u))
const current = computed(() => chain.value[tried.value] ?? null)
const img = ref<HTMLImageElement | null>(null)
// Intrinsic size hints for the frame ratio, so nothing shifts while loading.
const size = computed(() => (props.wide ? { w: 640, h: 360 } : { w: 400, h: 300 }))
const check = () => {
  const el = img.value
  if (el && el.complete && el.naturalWidth <= 1) tried.value++
}
// An image that settled before hydration fired its events before Vue listened.
onMounted(check)
watch(() => [props.src, props.fallback], () => { tried.value = 0 })
</script>

<template>
  <div class="frame" :class="{ 'frame--wide': wide, 'frame--bare': !mark && !current }">
    <img
      v-if="current" ref="img" :key="current" :src="current" :alt="alt" :width="size.w" :height="size.h"
      :loading="eager ? 'eager' : 'lazy'" decoding="async" referrerpolicy="no-referrer"
      @load="check" @error="tried++"
    >
    <span v-else-if="mark" class="frame__mark" :title="alt">{{ mark }}</span>
  </div>
</template>

<style scoped>
.frame { position: relative; display: grid; place-items: center; aspect-ratio: 4 / 3; background: var(--bg-surface); overflow: hidden; }
.frame--wide { aspect-ratio: 16 / 9; }
/* A small slot with no picture and no room for a mark stays empty, not a grey box. */
.frame--bare { background: none; }
.frame img { width: 100%; height: 100%; object-fit: contain; padding: 6%; mix-blend-mode: var(--image-blend, normal); }
.frame__mark {
  display: inline-block; max-width: 88%; font-family: var(--font-mono); font-size: 0.8125rem; letter-spacing: 0.02em;
  color: var(--fg-muted); text-align: center; overflow-wrap: anywhere;
}
.frame--wide .frame__mark { font-size: clamp(0.9375rem, 1.6vw, 1.25rem); }
</style>
