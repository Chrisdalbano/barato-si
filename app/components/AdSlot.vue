<script setup lang="ts">
// One AdSense unit, labelled. Renders nothing at all unless both the client id
// and this slot's id were set at build time. The box keeps a fixed minimum
// height from the first paint, so a late ad never pushes the page around.
const props = defineProps<{ slot: 'stream' | 'footer' }>()
const cfg = useRuntimeConfig().public
const client = computed(() => String(cfg.adsenseClient ?? ''))
const unit = computed(() => String((props.slot === 'stream' ? cfg.adsenseSlotStream : cfg.adsenseSlotFooter) ?? ''))
const on = computed(() => /^ca-pub-\d+$/.test(client.value) && /^\d+$/.test(unit.value))
const { t } = useLang()

onMounted(() => {
  if (!on.value) return
  try {
    const w = window as unknown as { adsbygoogle?: unknown[] }
    ;(w.adsbygoogle = w.adsbygoogle || []).push({})
  } catch { /* blocked: the labelled box stays empty */ }
})
</script>

<template>
  <aside v-if="on" class="ad" :class="`ad--${slot}`" :aria-label="t.adLabel">
    <p class="ad__label">{{ t.adLabel }}</p>
    <ins
      class="adsbygoogle ad__unit" style="display:block" :data-ad-client="client" :data-ad-slot="unit"
      data-ad-format="auto" data-full-width-responsive="true"
    />
  </aside>
</template>

<style scoped>
.ad { display: grid; gap: 4px; padding: 10px 0; }
.ad__label { margin: 0; font-size: 0.625rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); }
.ad__unit { min-height: 120px; background: var(--bg-surface); }
.ad--footer .ad__unit { min-height: 100px; }
</style>
