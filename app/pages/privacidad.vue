<script setup lang="ts">
definePageMeta({ alias: ['/en/privacy'] })

const { t } = useLang()
usePageSeo('privacidad', { es: 'Privacidad', en: 'Privacy' })
</script>

<template>
  <div class="wrap pv">
    <header class="pv__head">
      <p class="eyebrow">{{ t.privacy.eyebrow }}</p>
      <h1 class="pv__title">{{ t.privacy.title }}<span class="pv__dot" aria-hidden="true">.</span></h1>
      <p class="pv__lede">{{ t.privacy.lede }}</p>
    </header>
    <section v-for="s in t.privacy.sections" :key="s.h" class="pv__sec prose">
      <h2>{{ s.h }}</h2>
      <p v-for="p in s.p" :key="p">{{ p }}</p>
    </section>
    <p class="pv__updated">{{ t.privacy.updated }}</p>
  </div>
</template>

<style scoped>
.pv__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); }
.pv__title { margin: 6px 0 10px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.pv__dot { color: var(--accent-lead); }
.pv__lede { margin: 0; max-width: var(--container-max-prose); font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-secondary); }
.pv__sec { display: grid; grid-template-columns: minmax(0, 14rem) minmax(0, 1fr); gap: 4px 32px; max-width: none; padding: 14px 0; border-top: 1px solid var(--border); }
.pv__sec:first-of-type { border-top: 2px solid var(--fg-primary); }
.pv__sec h2 { margin: 0; font-size: 1rem; font-weight: 600; }
.pv__sec p { grid-column: 2; max-width: var(--container-max-prose); margin: 0; color: var(--fg-secondary); }
.pv__updated { margin: 20px 0 0; font-size: 0.75rem; color: var(--fg-muted); }
@media (max-width: 640px) {
  .pv__sec { grid-template-columns: 1fr; }
  .pv__sec p { grid-column: 1; }
}
</style>
