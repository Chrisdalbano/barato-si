<template>
  <section class="teaser" aria-labelledby="api-title">
    <div class="teaser__text">
      <p class="eyebrow">Para scripts y agentes</p>
      <h2 id="api-title" class="teaser__title">Los mismos datos, en JSON.</h2>
      <p>
        Todo lo que ves aquí sale de un archivo estático que cualquiera puede leer. Sin clave, sin registro.
        Se regenera una vez al día, sobre las 11:00 UTC.
      </p>
      <ul class="teaser__eps">
        <li v-for="e in ENDPOINTS.slice(0, 4)" :key="e.path"><code>{{ e.path }}</code></li>
      </ul>
      <NuxtLink to="/api" class="teaser__more">Documentación de la API <span aria-hidden="true">&rarr;</span></NuxtLink>
    </div>
    <CodeBlock :code="CURL_EXAMPLE" label="curl" />
  </section>
</template>

<style scoped>
.teaser { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 32px clamp(32px, 5vw, 80px); align-items: start; margin-top: clamp(64px, 8vw, 112px); padding-top: clamp(32px, 5vw, 56px); border-top: 2px solid var(--fg-primary); }
.teaser__text { display: grid; gap: 12px; max-width: 52ch; }
.teaser__text p { margin: 0; color: var(--fg-secondary); }
.teaser__text .eyebrow { color: var(--fg-secondary); }
.teaser__title { margin: 0; font-size: clamp(1.5rem, 3vw, 2.25rem); letter-spacing: -0.03em; font-weight: 600; }
.teaser__eps { margin: 4px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 0.875rem; }
.teaser__more { font-weight: 600; text-decoration: none; }
.teaser__more:hover { text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 860px) { .teaser { grid-template-columns: 1fr; } }
</style>
