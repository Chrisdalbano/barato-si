<script setup lang="ts">
definePageMeta({ alias: ['/en/api'] })

const { locale } = useLang()
usePageSeo('api', { es: 'API', en: 'API' })
const en = computed(() => locale.value === 'en')
const endpoints = computed(() => endpointsFor(locale.value))
const schema = computed(() => schemaFor(locale.value))
const fetchExample = computed(() => fetchExampleFor(locale.value))
</script>

<template>
  <div class="wrap doc">
    <header class="doc__head">
      <p class="eyebrow">API</p>
      <template v-if="en">
        <h1 class="doc__title">Barato, sí. Also in JSON<span class="doc__dot" aria-hidden="true">.</span></h1>
        <p class="doc__lede">
          barato.si is a JSON file rebuilt every three hours, with a website on top. The API is free, needs no key
          and is made of static files: cache them and do not ask more often than that.
        </p>
      </template>
      <template v-else>
        <h1 class="doc__title">Barato, sí. También en JSON<span class="doc__dot" aria-hidden="true">.</span></h1>
        <p class="doc__lede">
          barato.si es un archivo JSON que se regenera cada tres horas, con una web encima. La API es gratis, no pide clave
          y son archivos estáticos: guárdalos en caché y no consultes más a menudo que eso.
        </p>
      </template>
    </header>

    <section class="doc__sec" aria-labelledby="ep">
      <h2 id="ep">Endpoints</h2>
      <table class="tbl">
        <thead><tr><th scope="col">{{ en ? 'Path' : 'Ruta' }}</th><th scope="col">{{ en ? 'What it returns' : 'Qué devuelve' }}</th></tr></thead>
        <tbody>
          <tr v-for="e in endpoints" :key="e.path">
            <td><code>{{ SITE }}{{ e.path }}</code></td>
            <td>{{ e.what }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="en" class="doc__note">
        Updates: every three hours (GitHub may delay a run for a while). The
        <code>generatedAt</code> field says when each file was generated.
      </p>
      <p v-else class="doc__note">
        Actualización: cada tres horas (GitHub puede retrasarla un rato). El campo
        <code>generatedAt</code> dice cuándo se generó cada archivo.
      </p>
    </section>

    <section class="doc__sec doc__examples" aria-labelledby="ex">
      <h2 id="ex">{{ en ? 'Examples' : 'Ejemplos' }}</h2>
      <div class="doc__codes">
        <CodeBlock :code="CURL_EXAMPLE" label="curl + jq" />
        <CodeBlock :code="fetchExample" label="fetch (JavaScript)" />
      </div>
    </section>

    <section class="doc__sec" aria-labelledby="sch">
      <h2 id="sch">{{ en ? 'Schema' : 'Esquema' }}</h2>
      <p v-if="en" class="doc__note">
        Each file is a <code>DealsFile</code>: <code>{{ FILE_FIELDS }}</code>.
        <code>version</code> is <code>3</code> since November 2026, <code>2</code> since October 6, 2026, and missing in earlier files.
        <code>sources</code> says which sources answered and which did not, and <code>direct</code> marks the ones that are the store itself,
        so a dead source never goes unnoticed. <code>classifier</code> says whether the model ran and how many offers it classified,
        so a model failure is never mistaken for "there were no candidates".
        <code>gate</code> (v3) is <code>{ considered, published, rejected, byReason }</code>: how many offers were looked at, how many were published and why the rest were rejected.
        Text fields written by barato.si (<code>reasons</code>, <code>errorSignals</code>, <code>reference.note</code>) are in Spanish.
        Each element of <code>deals</code> is a <code>Deal</code>:
      </p>
      <p v-else class="doc__note">
        Cada archivo es un <code>DealsFile</code>: <code>{{ FILE_FIELDS }}</code>.
        <code>version</code> vale <code>3</code> desde noviembre de 2026, <code>2</code> desde el 6 de octubre de 2026 y falta en los archivos anteriores.
        <code>sources</code> dice qué fuentes respondieron y cuáles no, y <code>direct</code> marca las que son la propia tienda,
        para que una fuente caída no pase desapercibida. <code>classifier</code> dice si el modelo corrió y cuántas ofertas clasificó,
        para que un fallo del modelo no se confunda con «no había candidatas».
        <code>gate</code> (v3) es <code>{ considered, published, rejected, byReason }</code>: cuántas ofertas se miraron, cuántas se publicaron y por qué se rechazó el resto.
        Cada elemento de <code>deals</code> es un <code>Deal</code>:
      </p>
      <table class="tbl tbl--schema">
        <thead><tr><th scope="col">{{ en ? 'Field' : 'Campo' }}</th><th scope="col">{{ en ? 'Type' : 'Tipo' }}</th><th scope="col">{{ en ? 'Note' : 'Nota' }}</th></tr></thead>
        <tbody>
          <tr v-for="r in schema" :key="r.field">
            <td><code>{{ r.field }}</code></td>
            <td><code>{{ r.type }}</code></td>
            <td>{{ r.note }}</td>
          </tr>
        </tbody>
      </table>
      <template v-if="en">
        <p class="doc__note">
          Change in v2: <code>syndication.itemXml</code> (each feed item's original XML) no longer travels in
          <code>deals.json</code>. It is in <code>/api/raw/YYYY-MM-DD.json</code>, one file per day, for anyone who needs
          full attribution. The new fields (<code>storeUrl</code>, <code>errorScore</code>, <code>history</code>, <code>ai</code>…)
          are optional or have a default: code that read v1 keeps working.
        </p>
        <p class="doc__note">
          Change in v3: <code>reference</code> replaces <code>listPrice</code> as the measure of what a product usually costs, and says where it comes from.
          With <code>kind: "list"</code> the reference is only what the seller says: treat it as the weakest evidence.
          Earlier files do not carry these fields; the site reads them as a list price when there is one. <code>url</code>, <code>storeUrl</code> and <code>listPrice</code> keep their meaning.
        </p>
      </template>
      <template v-else>
        <p class="doc__note">
          Cambio en v2: <code>syndication.itemXml</code> (el XML original de cada elemento del feed) ya no viaja en
          <code>deals.json</code>. Está en <code>/api/raw/YYYY-MM-DD.json</code>, un archivo por día, para quien necesite
          la atribución completa. Los campos nuevos (<code>storeUrl</code>, <code>errorScore</code>, <code>history</code>, <code>ai</code>…)
          son opcionales o tienen un valor por defecto: el código que leía v1 sigue funcionando.
        </p>
        <p class="doc__note">
          Cambio en v3: <code>reference</code> sustituye a <code>listPrice</code> como medida de lo que suele costar un producto, y dice de dónde sale.
          Con <code>kind: "list"</code> la referencia es solo lo que dice el vendedor: trátala como la evidencia más débil.
          Los archivos anteriores no traen estos campos; la web los trata como un precio de lista cuando lo hay. <code>url</code>, <code>storeUrl</code> y <code>listPrice</code> no cambian de significado.
        </p>
      </template>
    </section>

    <section v-if="en" class="doc__sec prose" aria-labelledby="fair">
      <h2 id="fair">Attribution and fair use</h2>
      <p>
        Credit barato.si and each offer's original source (the <code>source</code> field). Keep the links and the attribution as they are.
        Do not rewrite the source's titles or present them as your own.
      </p>
      <p>
        The score, the label and the reasons are barato.si's independent analysis, not the source's text.
        "Possible price error" is an automatic signal, not a confirmation that the store made a mistake.
      </p>
      <p>
        Do not resell the sources' content or use it to train models without their owners' permission.
        Some sources set their own terms: DealNews content, for example, may not be used in public browser extensions.
      </p>
      <p>
        Offers expire and may have conditions: coupons, a minimum order for shipping, membership. Check at the source before you buy.
      </p>
    </section>
    <section v-else class="doc__sec prose" aria-labelledby="fair">
      <h2 id="fair">Atribución y uso razonable</h2>
      <p>
        Cita a barato.si y a la fuente original de cada oferta (el campo <code>source</code>). Conserva los enlaces tal cual y la atribución.
        No reescribas los títulos de la fuente ni los presentes como tuyos.
      </p>
      <p>
        La puntuación, la etiqueta y las razones son análisis independiente de barato.si, no texto de la fuente.
        «Posible error de precio» es una señal automática, no una confirmación de que la tienda se equivocó.
      </p>
      <p>
        No revendas el contenido de las fuentes ni lo uses para entrenar modelos sin permiso de sus titulares.
        Algunas fuentes ponen sus propias condiciones: el contenido de DealNews, por ejemplo, no puede usarse en extensiones públicas de navegador.
      </p>
      <p>
        Las ofertas caducan y pueden tener condiciones: cupones, compra mínima para el envío, membresía. Compruébalo en la fuente antes de comprar.
      </p>
    </section>
  </div>
</template>

<style scoped>
.doc__head { padding: clamp(20px, 3vw, 36px) 0 clamp(20px, 3vw, 32px); max-width: 60rem; }
.doc__title { margin: 6px 0 12px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.doc__dot { color: var(--accent-lead); }
.doc__lede { margin: 0; font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-secondary); max-width: var(--container-max-prose); }
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
