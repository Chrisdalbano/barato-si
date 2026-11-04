<script setup lang="ts">
const { locale, t, lp } = useLang()
const endpoints = computed(() => endpointsFor(locale.value))
</script>

<template>
  <section class="teaser" aria-labelledby="api-title">
    <div class="teaser__text">
      <p class="eyebrow">{{ t.teaser.eyebrow }}</p>
      <h2 id="api-title" class="teaser__title">{{ t.teaser.title }}</h2>
      <p>{{ t.teaser.body }}</p>
      <ul class="teaser__eps">
        <li v-for="e in endpoints.slice(0, 3)" :key="e.path"><code>{{ e.path }}</code></li>
      </ul>
      <NuxtLink :to="lp('/api')" class="teaser__more">{{ t.teaser.more }} <span aria-hidden="true">&rarr;</span></NuxtLink>
    </div>
    <CodeBlock :code="CURL_EXAMPLE" label="curl" />
  </section>
</template>

<style scoped>
.teaser { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 24px clamp(32px, 5vw, 80px); align-items: start; margin-top: clamp(40px, 5vw, 64px); padding-top: 16px; border-top: 1px solid var(--fg-primary); }
.teaser__text { display: grid; gap: 12px; max-width: 52ch; }
.teaser__text p { margin: 0; color: var(--fg-secondary); }
.teaser__text .eyebrow { color: var(--fg-secondary); }
.teaser__title { margin: 0; font-size: clamp(1.125rem, 2vw, 1.375rem); letter-spacing: -0.02em; font-weight: 600; }
.teaser__eps { margin: 4px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 0.875rem; }
.teaser__more { font-weight: 600; text-decoration: none; }
.teaser__more:hover { text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 860px) { .teaser { grid-template-columns: 1fr; } }
</style>
