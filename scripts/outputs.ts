import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Deal, DealsFile } from '../lib/types.ts'
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
export async function writeOutputs(root: string, file: DealsFile): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(file.date) || !Number.isFinite(Date.parse(file.generatedAt)) || file.count !== file.deals.length || file.deals.length > 400) throw new Error('Invalid output contract')
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
  const paths = ['', 'api/deals.json', 'api/errors.json', 'feed.xml', 'errors.xml']
  const outputs: [string, string][] = [
    [join(archive, file.date + '.json'), json],
    [join(rawDir, file.date + '.json'), JSON.stringify(raw) + '\n'],
    [join(root, 'api/errors.json'), JSON.stringify({ date: file.date, generatedAt: file.generatedAt, deals: errors.map(compact) }) + '\n'],
    [join(root, 'feed.xml'), rss(file)],
    [join(root, 'errors.xml'), rss({ ...file, deals: errors }, true)],
    [join(root, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://barato.si/sitemap.xml\n'],
    [join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>https://barato.si/${path}</loc><lastmod>${file.generatedAt}</lastmod></url>`).join('')}</urlset>\n`],
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
Actualización UTC: ${file.generatedAt}. Programación: 11:00 y 23:00 UTC.

## Endpoints
https://barato.si/api/deals.json — versión 2, hasta 400 ofertas; equilibrio entre videojuegos y otras categorías en las primeras 30.
https://barato.si/api/errors.json — { date, generatedAt, deals }, todas las ofertas con errorScore >= 40, de mayor a menor puntuación.
https://barato.si/errors.xml — RSS 2.0 de posibles errores, con evidencia en español.
https://barato.si/api/deals/YYYY-MM-DD.json — archivo de los últimos 30 días UTC.
https://barato.si/api/raw/YYYY-MM-DD.json — contenido sindicado original por id: { itemXml, descriptionHtml }, últimos 30 días UTC.
https://barato.si/api/index.json — { latest, days }, fechas disponibles en orden descendente.
https://barato.si/feed.xml — RSS 2.0, hasta 30 ofertas.

## Esquema v2
DealsFile: { version: 2, date, generatedAt, count, sources, deals, classifier? }.
sources: { name, ok, count, requests, ms, direct, error?, errorEs? }. Los conteos son anteriores a la deduplicación.
Deal: { id, title, url, storeUrl, store, storeDomain, source, sourceUrl, currency, price, listPrice, discountPct, image, category, publishedAt, foundAt, score, errorScore, errorSignals, flag, reasons, sourceText?, sourceSignal?, history?, ai?, syndication? }.
score (0–100) mide la oferta; errorScore (0–100) estima una anomalía de precio. Error probable requiere >= 70; >= 40 identifica candidatos para revisar. No equivale a una probabilidad estadística ni confirma un error.
storeUrl es la página del comercio cuando se conoce; url conserva el enlace de la fuente. image usa HTTPS o null cuando falta en la fuente. Los precios usan la moneda indicada, sin conversión. listPrice y discountPct pueden ser null.
history: { days, minPrice, maxPrice, firstSeen }, observaciones anteriores del archivo, no precios históricos externos.
ai: { product, category, verdict, confidence, note, model }, clasificación opcional validada. classifier: { model, ok, classified, cached, error? }; se omite sin clave configurada. Los fallos del modelo no desactivan las reglas automáticas.
syndication: { attribution, feedUrl, itemUrl }; el XML y HTML originales están en el archivo raw.
Las clasificaciones visibles son Error probable, Baratísimo y Normal. Se conserva el idioma original de los títulos de las fuentes.

## Fuentes y uso razonable
Directas: Steam (búsqueda y promociones), GOG (catálogo), Epic (juegos gratis).
Agregadores: CheapShark (conserva sus enlaces de redirección), DealNews (cuatro RSS), Techbargains (RSS con enlaces al comercio).
Opcionales con clave: Best Buy y Woot (directas), IsThereAnyDeal (agregador).
Conserva los enlaces, la atribución y el contenido original de DealNews: https://www.dealnews.com/pages/rss.html. No uses su contenido en extensiones públicas de navegador. No insertes HTML/XML sin sanearlo. El análisis de barato.si es independiente.
Cita barato.si y la fuente. Guarda las respuestas en caché; bastan dos consultas diarias. No revendas contenido ni lo uses para entrenar modelos sin permiso de los titulares.
Las ofertas pueden caducar o depender de región, envío, cupones y membresías. Verifica condiciones y evidencia en la fuente. Un descuento profundo no demuestra un error.
`
}
