<script setup lang="ts">
// One playful line tucked under the wordmark, for visitors on the Spanish site
// whose browser asks for no Spanish at all. Client-only: it is decided after
// mount from navigator.languages, so the prerendered HTML never contains it.
// It is absolutely positioned under the header, so showing it moves nothing.
const { locale, t } = useLang()
const route = useRoute()
const KEY = 'barato.lang-callout'
const show = ref(false)

onMounted(() => {
  if (locale.value !== 'es') return
  try { if (localStorage.getItem(KEY) === 'off') return } catch { /* storage blocked: still fine to show */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  show.value = !langs.some(l => /^es\b/i.test(l ?? ''))
})

function dismiss() {
  show.value = false
  try { localStorage.setItem(KEY, 'off') } catch { /* nothing to remember with */ }
}
const target = computed(() => localePath(route.path, 'en'))
</script>

<template>
  <p v-if="show && locale === 'es'" class="lc" lang="en">
    <span class="lc__text">{{ t.callout.lead }}</span>
    <a :href="target" class="lc__go" hreflang="en" @click="dismiss">{{ t.callout.action }} <span aria-hidden="true">&rarr;</span></a>
    <button type="button" class="lc__x" :aria-label="t.callout.dismiss" @click="dismiss"><span aria-hidden="true">&times;</span></button>
  </p>
</template>

<style scoped>
.lc {
  position: absolute; z-index: 20; top: calc(100% + 1px); left: 0;
  display: flex; align-items: baseline; gap: 4px 12px; max-width: min(92vw, 40rem); margin: 0; padding: 6px 10px 7px;
  background: var(--bg-canvas); border: 1px solid var(--fg-primary); border-top: 0;
  font-size: 0.75rem; line-height: 1.35; color: var(--fg-secondary);
  animation: lc-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.lc__text { min-width: 0; }
.lc__go { flex: none; font-weight: 600; color: var(--link-fg); text-decoration: none; white-space: nowrap; }
.lc__go:hover { text-decoration: underline; text-underline-offset: 3px; }
.lc__x { flex: none; border: 0; background: none; padding: 0 2px; font: inherit; font-size: 1rem; line-height: 1; color: var(--fg-muted); cursor: pointer; }
.lc__x:hover { color: var(--fg-primary); }
@keyframes lc-in { from { opacity: 0; transform: translateY(-4px); } }
@media (max-width: 540px) { .lc { flex-wrap: wrap; } }
@media (prefers-reduced-motion: reduce) { .lc { animation: none; } }
</style>
