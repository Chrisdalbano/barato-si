import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Deal, DealsFile, ErrorsFile, HighlightsFile, OracleFile } from '../lib/types.ts'
import { nearestMisses, recentCandidates } from '../lib/error-feed.ts'
import { xmlEscape as x } from '../lib/feeds.ts'
import { formatMoney } from '../lib/format.ts'

const collected = new WeakMap<DealsFile, Deal[]>()
export function retainCollected(file: DealsFile, all: Deal[]) { collected.set(file, all) }

export function rss(file: DealsFile, errors = false): string {
  const deals = errors ? file.deals : file.deals.slice(0, 30)
  const items = deals.map(d => !errors && d.syndication?.itemXml || `<item><title>${x(d.title)}</title><link>${x(d.url)}</link><guid isPermaLink="false">${x(d.id)}</guid><pubDate>${new Date(d.publishedAt).toUTCString()}</pubDate><description>${x(`${formatMoney(d.price)} ${d.currency}. ${(errors ? d.errorSignals : d.reasons).join('. ')}. Fuente: ${d.source}`)}</description><source url="${x(d.sourceUrl)}">${x(d.source)}</source></item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dealnews="https://www.dealnews.com/ns/rss/1.0.htm" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>barato.si — ${errors ? 'posibles errores de precio' : 'ofertas del día'}</title><link>https://barato.si/</link><description>${errors ? 'Señales de posibles errores de precio con evidencia. No son confirmaciones.' : 'Ofertas seleccionadas. Contenido y enlaces originales de cada fuente. La clasificación de barato.si es independiente.'}</description><language>es</language><lastBuildDate>${new Date(file.generatedAt).toUTCString()}</lastBuildDate><atom:link href="https://barato.si/${errors ? 'errors' : 'feed'}.xml" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>\n`
}
function compact(d: Deal): Deal {
  const copy = { ...d }
  if (d.syndication) {
    const { itemXml: _xml, descriptionHtml: _html, ...attribution } = d.syndication
    copy.syndication = attribution
  }
  return copy
}
/** Files derived from the run that the pipeline also publishes. Optional so older callers keep working. */
export interface Extras { highlights?: HighlightsFile; oracle?: OracleFile }
const SITE = 'https://barato.si/'
/** Each Spanish route and its English twin. The UI owns the pages; the pipeline owns the sitemap. */
export const PAGES: [string, string][] = [['', 'en/'], ['errores/', 'en/errores/'], ['archivo/', 'en/archivo/'], ['api/', 'en/api/'], ['si/', 'en/si/'], ['privacidad/', 'en/privacy/']] // trailing slash: what GitHub Pages serves and what the UI canonicals use
export function sitemap(generatedAt: string): string {
  const alternates = (es: string, en: string) => `<xhtml:link rel="alternate" hreflang="es" href="${SITE}${es}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${es}"/>`
  const pages = PAGES.flatMap(([es, en]) => [es, en].map(loc => `<url><loc>${SITE}${loc}</loc><lastmod>${generatedAt}</lastmod>${alternates(es, en)}</url>`))
  const files = ['api/deals.json', 'api/errors.json', 'feed.xml', 'errors.xml'].map(path => `<url><loc>${SITE}${path}</loc><lastmod>${generatedAt}</lastmod></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${[...pages, ...files].join('')}</urlset>\n`
}
/** Published day archives in [from, before). An unreadable archive is skipped, never invented. */
async function readArchives(dir: string, names: string[], from: string, before: string): Promise<{ date: string; deals: Deal[] }[]> {
  const out: { date: string; deals: Deal[] }[] = []
  for (const name of names) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) >= from && name.slice(0, 10) < before) {
    try {
      const value = JSON.parse(await readFile(join(dir, name), 'utf8'))
      if (Array.isArray(value?.deals)) out.push({ date: name.slice(0, 10), deals: value.deals })
    } catch { /* skipped */ }
  }
  return out
}
export async function writeOutputs(root: string, file: DealsFile, extras: Extras = {}): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(file.date) || !Number.isFinite(Date.parse(file.generatedAt)) || file.count !== file.deals.length || file.deals.length > (file.version === 3 ? 250 : 400)) throw new Error('Invalid output contract')
  const all = collected.get(file) || file.deals
  const errors = all.filter(d => d.errorScore >= 40).sort((a, b) => b.errorScore - a.errorScore || b.score - a.score || a.id.localeCompare(b.id))
  const raw = Object.fromEntries(all.filter(d => d.syndication?.itemXml || d.syndication?.descriptionHtml).map(d => [d.id, { itemXml: d.syndication!.itemXml, descriptionHtml: d.syndication!.descriptionHtml }]))
  const clean = { ...file, deals: file.deals.map(compact) }
  const json = JSON.stringify(clean) + '\n'
  if (Buffer.byteLength(json) > 700_000) throw new Error('El archivo supera el límite de tamaño; se conservó la publicación anterior.')
  const archive = join(root, 'api/deals'), rawDir = join(root, 'api/raw')
  await mkdir(archive, { recursive: true }); await mkdir(rawDir, { recursive: true })
  const cutoff = new Date(Date.parse(file.date + 'T00:00:00Z') - 29 * 86400000).toISOString().slice(0, 10)
  const names = await readdir(archive)
  const days = [...new Set([...names.filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map(n => n.slice(0, 10)).filter(d => d >= cutoff && d <= file.date), file.date])].sort().reverse()
  const recent = recentCandidates(await readArchives(archive, names, cutoff, file.date), file.date, errors)
  const errorsFile: ErrorsFile = { date: file.date, generatedAt: file.generatedAt, deals: errors.map(compact), recent: recent.map(r => ({ date: r.date, deal: compact(r.deal) })), nearest: nearestMisses(all).map(compact) }
  const outputs: [string, string][] = [
    [join(archive, file.date + '.json'), json],
    [join(rawDir, file.date + '.json'), JSON.stringify(raw) + '\n'],
    [join(root, 'api/errors.json'), JSON.stringify(errorsFile) + '\n'],
    ...(extras.highlights ? [[join(root, 'api/highlights.json'), JSON.stringify(extras.highlights) + '\n'] as [string, string]] : []),
    ...(extras.oracle ? [[join(root, 'api/oracle.json'), JSON.stringify(extras.oracle) + '\n'] as [string, string]] : []),
    [join(root, 'feed.xml'), rss(file)],
    [join(root, 'errors.xml'), rss({ ...file, deals: errors }, true)],
    [join(root, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://barato.si/sitemap.xml\n'],
    [join(root, 'sitemap.xml'), sitemap(file.generatedAt)],
    [join(root, 'llms.txt'), discovery(file)],
    [join(root, 'api/index.json'), JSON.stringify({ latest: file.date, days }) + '\n'],
    [join(root, 'api/deals.json'), json],
  ]
  // Stage every complete document before replacing any published file; current JSON is last.
  try {
    for (const [path, body] of outputs) await writeFile(path + '.tmp', body, 'utf8')
    for (const [path] of outputs) await rename(path + '.tmp', path)
  } finally { for (const [path] of outputs) await rm(path + '.tmp', { force: true }) }
  for (const dir of [archive, rawDir]) for (const name of await readdir(dir)) {
    if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) < cutoff) await rm(join(dir, name))
  }
}
function discovery(file: DealsFile): string {
  return `# barato.si — barato, sí
Ofertas y posibles errores de precio con evidencia. API JSON gratuita, sin autenticación.
Actualización UTC: ${file.generatedAt}. Programación: cada tres horas, a la hora en punto UTC.

## Endpoints
https://barato.si/api/deals.json — versión 3, hasta 250 ofertas. Orden editorial: candidatos a error de precio primero, después interés y enlaces directos; videojuegos al final.
https://barato.si/api/errors.json — { date, generatedAt, deals, recent?, nearest? }. deals: todas las ofertas con errorScore >= 40, de mayor a menor puntuación; puede estar vacío. recent: candidatos (>= 40) de los archivos publicados de los últimos 30 días, uno por producto, el más reciente primero. nearest: las 5 puntuaciones más altas de hoy por debajo de 40; las más cercanas, no son errores.
https://barato.si/api/highlights.json — { version: 1, date, generatedAt, slots }. Cada slot: { id, titleEs, titleEn, noteEs, noteEn, dealIds }, con la regla escrita en note y de 3 a 12 ids de deals.json. Un slot sin 3 ofertas no se publica.
https://barato.si/api/oracle.json — el oráculo .si: ¿compra ahora o espera? { version: 1, date, generatedAt, model, horizonDays, dropThresholdPct, predictions, scorecard }. Ver abajo.
https://barato.si/errors.xml — RSS 2.0 de posibles errores, con evidencia en español.
https://barato.si/api/deals/YYYY-MM-DD.json — archivo de los últimos 30 días UTC.
https://barato.si/api/raw/YYYY-MM-DD.json — contenido sindicado original por id: { itemXml, descriptionHtml }, últimos 30 días UTC.
https://barato.si/api/index.json — { latest, days }, fechas disponibles en orden descendente.
https://barato.si/feed.xml — RSS 2.0, hasta 30 ofertas.

## Esquema v3
DealsFile: { version: 3, date, generatedAt, count, sources, deals, gate, classifier? }.
sources: { name, ok, count, requests, ms, direct, error?, errorEs? }. Los conteos son anteriores a la deduplicación.
Deal: { id, title, url, storeUrl, store, storeDomain, source, sourceUrl, currency, price, listPrice, discountPct, image, category, publishedAt, foundAt, score, errorScore, errorSignals, flag, reasons, sourceText?, sourceSignal?, history?, ai?, syndication?, productKey?, brand?, reference?, referenceDiscountPct?, interest?, interestSignals?, direct?, seenIn?, staffPick? }.
score (0–100) mide la oferta; errorScore (0–100) estima una anomalía de precio. Error probable requiere >= 70; >= 40 identifica candidatos para revisar. No equivale a una probabilidad estadística ni confirma un error.
storeUrl es la página del comercio cuando se conoce; url conserva el enlace de la fuente. image usa HTTPS o null cuando falta en la fuente. Los precios usan la moneda indicada, sin conversión. listPrice y discountPct pueden ser null.
history: { days, minPrice, maxPrice, firstSeen }, observaciones anteriores del registro de precios, no precios históricos externos.
ai: { product, category, verdict, confidence, note, model }, clasificación opcional validada. classifier: { model, ok, classified, cached, error? }; se omite sin clave configurada. Los fallos del modelo no desactivan las reglas automáticas.
syndication: { attribution, feedUrl, itemUrl }; el XML y HTML originales están en el archivo raw.
Las clasificaciones visibles son Error probable, Baratísimo y Normal. Se conserva el idioma original de los títulos de las fuentes.

## Fuentes y uso razonable
Directas: Steam (búsqueda y promociones), GOG (catálogo), Epic (juegos gratis).
Agregadores: CheapShark (conserva sus enlaces de redirección), DealNews (cuatro RSS), Techbargains (RSS con enlaces al comercio).
Opcionales con clave: Best Buy y Woot (directas), IsThereAnyDeal (agregador).
Conserva los enlaces, la atribución y el contenido original de DealNews: https://www.dealnews.com/pages/rss.html. No uses su contenido en extensiones públicas de navegador. No insertes HTML/XML sin sanearlo. El análisis de barato.si es independiente.
Cita barato.si y la fuente. Guarda las respuestas en caché; basta una consulta cada tres horas. No revendas contenido ni lo uses para entrenar modelos sin permiso de los titulares.
Las ofertas pueden caducar o depender de región, envío, cupones y membresías. Verifica condiciones y evidencia en la fuente. Un descuento profundo no demuestra un error.

## El oráculo .si
Para cada producto publicado que nuestro registro de precios sigue, pDrop estima la probabilidad de observar, en los próximos horizonDays días (14), un precio al menos dropThresholdPct (5 %) más bajo que el de hoy. Modelo beta-binomial con Bayes empírico: una distribución Beta a priori por categoría, ajustada por el método de los momentos sobre todos los productos del registro, actualizada con la historia propia del producto; pDrop es la media a posteriori. verdict: espera (pDrop >= 0,5), compra (< 0,5) o aprendiendo (menos de 2 ventanas propias completas o datos agregados insuficientes). Cada predicción se guarda y se resuelve contra el registro cuando pasa su horizonte; scorecard publica el Brier del modelo frente al de la tasa base y 5 tramos de calibración. Un scorecard vacío significa que aún no ha vencido ninguna predicción, no que acierte. El registro empezó en octubre de 2026 y solo contiene precios que observamos: no es historia externa.

## Quién
barato.si es un proyecto de Formship LLC (https://formship.io).

## English
barato.si is a daily index of the deepest US discounts and possible price errors, with the evidence behind each score. Free JSON API, no authentication, refreshed every three hours. The site is in Spanish at / and in English at /en (/en/errores, /en/archivo, /en/api, /en/si).
Endpoints: /api/deals.json (version 3, up to 250 deals, error candidates first), /api/errors.json (errorScore >= 40, may be empty; plus recent: past candidates from the published 30-day archives, and nearest: today's 5 highest scores below 40, which are not errors), /api/highlights.json (carousel slots, each with its rule stated in noteEn), /api/oracle.json (the .si oracle), /api/deals/YYYY-MM-DD.json, /api/index.json, /feed.xml, /errors.xml.
errorScore is a heuristic from 0 to 100: 70+ is a probable error, 40+ a candidate to review. It is not a calibrated probability and confirms nothing. Thresholds are never lowered to fill a page.
The .si oracle answers "buy now or wait?". pDrop is the probability that an observed price within 14 days is at least 5% below today's, from a beta-binomial empirical-Bayes model: a Beta prior per category fitted by method of moments across our price ledger, updated with the product's own history. verdict is espera (wait, pDrop >= 0.5), compra (buy, < 0.5) or aprendiendo (learning: fewer than 2 completed windows of its own, or too little pooled data). Every prediction is logged and resolved against the ledger after its horizon; scorecard reports the model's Brier score against a base-rate baseline and 5 calibration buckets. An empty scorecard means nothing has resolved yet. The ledger started in October 2026 and holds only prices we observed.
Cite barato.si and the original source. Cache responses; one request every three hours is enough. barato.si is a Formship LLC project (https://formship.io).
`
}
