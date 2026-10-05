<script setup lang="ts">
useSeoMeta({
  title: 'API · barato.si',
  description: 'API JSON y RSS gratis con los chollos y probables errores de precio del día. Sin clave. Se actualiza a diario sobre las 11:00 UTC.',
  ogTitle: 'API · barato.si',
  ogUrl: `${SITE}/api`,
})
useHead({ link: [{ rel: 'canonical', href: `${SITE}/api` }] })
</script>

<template>
  <div class="wrap doc">
    <header class="doc__head">
      <p class="eyebrow">API</p>
      <h1 class="doc__title">Hecho para leerse con código.</h1>
      <p class="doc__lede">
        barato.si es un archivo JSON que se regenera cada día, con una web encima. La API es gratis, no pide clave
        y son ficheros estáticos: guárdalos en caché y con una consulta al día basta.
      </p>
    </header>

    <section class="doc__sec" aria-labelledby="ep">
      <h2 id="ep">Endpoints</h2>
      <table class="tbl">
        <thead><tr><th scope="col">Ruta</th><th scope="col">Qué devuelve</th></tr></thead>
        <tbody>
          <tr v-for="e in ENDPOINTS" :key="e.path">
            <td><code>{{ SITE }}{{ e.path }}</code></td>
            <td>{{ e.what }}</td>
          </tr>
        </tbody>
      </table>
      <p class="doc__note">
        Actualización: diaria, sobre las 11:00 UTC (GitHub puede retrasarla un rato). El campo
        <code>generatedAt</code> dice cuándo se generó cada archivo.
      </p>
    </section>

    <section class="doc__sec doc__examples" aria-labelledby="ex">
      <h2 id="ex">Ejemplos</h2>
      <div class="doc__codes">
        <CodeBlock :code="CURL_EXAMPLE" label="curl + jq" />
        <CodeBlock :code="FETCH_EXAMPLE" label="fetch (JavaScript)" />
      </div>
    </section>

    <section class="doc__sec" aria-labelledby="sch">
      <h2 id="sch">Esquema</h2>
      <p class="doc__note">
        Cada archivo es un <code>DealsFile</code>: <code>{ date, generatedAt, count, sources[], deals[] }</code>.
        <code>sources</code> dice qué fuentes respondieron y cuáles no, para que una fuente caída no pase desapercibida.
        Cada elemento de <code>deals</code> es un <code>Deal</code>:
      </p>
      <table class="tbl tbl--schema">
        <thead><tr><th scope="col">Campo</th><th scope="col">Tipo</th><th scope="col">Nota</th></tr></thead>
        <tbody>
          <tr v-for="r in SCHEMA" :key="r.field">
            <td><code>{{ r.field }}</code></td>
            <td><code>{{ r.type }}</code></td>
            <td>{{ r.note }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="doc__sec prose" aria-labelledby="fair">
      <h2 id="fair">Atribución y uso razonable</h2>
      <p>
        Cita a barato.si y a la fuente original. Conserva los enlaces tal cual y la atribución (hoy, DealNews).
        No reescribas los títulos de la fuente ni los presentes como tuyos.
      </p>
      <p>
        La puntuación, la etiqueta y las razones son análisis independiente de barato.si, no texto de la fuente.
        «Error probable» es una señal automática, no una confirmación de que la tienda se equivocó.
      </p>
      <p>
        No revendas el contenido de las fuentes ni lo uses para entrenar modelos sin permiso de sus titulares.
        El contenido de DealNews no puede usarse en extensiones públicas de navegador.
      </p>
      <p>
        Las ofertas caducan y pueden tener condiciones: cupones, envío mínimo, ser socio. Compruébalo en la fuente antes de comprar.
      </p>
    </section>
  </div>
</template>

<style scoped>
.doc__head { padding: clamp(40px, 6vw, 88px) 0 clamp(28px, 4vw, 48px); max-width: 60rem; }
.doc__title { margin: 8px 0 20px; font-size: clamp(2.25rem, 6vw, 4.75rem); line-height: 0.98; font-weight: 600; letter-spacing: -0.045em; }
.doc__lede { margin: 0; font-size: clamp(1.0625rem, 1.6vw, 1.25rem); color: var(--fg-secondary); max-width: var(--container-max-prose); }
.doc__sec { padding: clamp(28px, 4vw, 48px) 0; border-top: 2px solid var(--fg-primary); }
.doc__sec h2 { margin: 0 0 20px; font-size: clamp(1.375rem, 2.6vw, 1.875rem); letter-spacing: -0.03em; font-weight: 600; }
.doc__note { max-width: var(--container-max-prose); color: var(--fg-secondary); font-size: 0.9375rem; }
.doc__codes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.tbl th { text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--fg-secondary); padding: 0 16px 8px 0; border-bottom: 1px solid var(--fg-primary); }
.tbl td { padding: 10px 16px 10px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
.tbl code { overflow-wrap: anywhere; }
.tbl--schema td:nth-child(2) { color: var(--fg-secondary); }
@media (max-width: 860px) { .doc__codes { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .tbl, .tbl tbody, .tbl tr, .tbl td { display: block; }
  .tbl thead { display: none; }
  .tbl tr { padding: 10px 0; border-bottom: 1px solid var(--border); }
  .tbl td { padding: 2px 0; border: 0; }
}
</style>
