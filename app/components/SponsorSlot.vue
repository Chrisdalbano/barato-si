<script setup lang="ts">
// The one sponsored slot: a single labelled line on the home page, from
// app/data/sponsor.json. Renders only while the sponsor is active and its last
// day has not passed (build date), so the prerendered page already has it or
// does not: no shift. Text is the sponsor's, rendered as text. rel="sponsored".
const sponsor = useSponsor()
const { t } = useLang()
</script>

<template>
  <aside v-if="sponsor" class="sp" :aria-label="t.sponsor.label">
    <span class="sp__label">{{ t.sponsor.label }}</span>
    <a class="sp__link" :href="sponsor.url" rel="sponsored noopener" target="_blank">
      <img v-if="sponsor.image" class="sp__img" :src="sponsor.image" alt="" width="40" height="40" loading="lazy">
      <strong class="sp__name">{{ sponsor.label }}</strong>
      <span class="sp__text">{{ sponsor.text }}</span>
      <span class="sp__go" aria-hidden="true">&rarr;</span>
    </a>
  </aside>
</template>

<style scoped>
.sp { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin: 18px 0 0; padding: 10px 0; border-top: 1px dashed var(--border-strong); border-bottom: 1px dashed var(--border-strong); }
.sp__label { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }
.sp__link { display: flex; flex: 1 1 20rem; align-items: center; gap: 4px 12px; flex-wrap: wrap; min-width: 0; color: var(--fg-primary); text-decoration: none; font-size: 0.9375rem; }
.sp__link:hover .sp__text { text-decoration: underline; text-underline-offset: 3px; }
.sp__img { width: 40px; height: 40px; object-fit: contain; flex: none; }
.sp__name { font-weight: 600; }
.sp__text { color: var(--fg-secondary); overflow-wrap: anywhere; }
.sp__go { color: var(--link-fg); font-weight: 600; }
</style>
