import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Deal, DealsFile, ErrorsFile, HighlightsFile, OracleFile, WeekFile } from '../lib/types.ts'
import { nearestMisses, recentCandidates } from '../lib/error-feed.ts'
import { xmlEscape as x } from '../lib/feeds.ts'
import { formatMoney } from '../lib/format.ts'
import { categories } from '../lib/categorize.ts'
import { CATEGORY_NAME_ES, categoryFeedPath, landingPages, landingPaths, storeFeedPath, storeSlug } from '../lib/landing.ts'
import { weekCopy, weekText } from '../lib/digest.ts'

const collected = new WeakMap<DealsFile, Deal[]>()
export function retainCollected(file: DealsFile, all: Deal[]) { collected.set(file, all) }

/** One RSS item per deal. DealNews items keep their original XML, as their terms require (not in the errors feed). */
function rssItem(d: Deal, errors: boolean): string {
  return !errors && d.syndication?.itemXml || `<item><title>${x(d.title)}</title><link>${x(d.url)}</link><guid isPermaLink="false">${x(d.id)}</guid><pubDate>${new Date(d.publishedAt).toUTCString()}</pubDate><description>${x(`${formatMoney(d.price)} ${d.currency}. ${(errors ? d.errorSignals : d.reasons).join('. ')}. Fuente: ${d.source}`)}</description><source url="${x(d.sourceUrl)}">${x(d.source)}</source></item>`
}
function channel(o: { title: string; link: string; description: string; self: string; generatedAt: string; items: string[] }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dealnews="https://www.dealnews.com/ns/rss/1.0.htm" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${x(o.title)}</title><link>${x(o.link)}</link><description>${x(o.description)}</description><language>es</language><lastBuildDate>${new Date(o.generatedAt).toUTCString()}</lastBuildDate><atom:link href="${x(o.self)}" rel="self" type="application/rss+xml"/>
${o.items.join('\n')}
</channel></rss>\n`
}

export function rss(file: DealsFile, errors = false): string {
  const deals = errors ? file.deals : file.deals.slice(0, 30)
  return channel({
    title: `barato.si — ${errors ? 'posibles errores de precio' : 'ofertas del día'}`,
    link: 'https://barato.si/',
    description: errors ? 'Señales de posibles errores de precio con evidencia. No son confirmaciones.' : 'Ofertas seleccionadas. Contenido y enlaces originales de cada fuente. La clasificación de barato.si es independiente.',
    self: `https://barato.si/${errors ? 'errors' : 'feed'}.xml`,
    generatedAt: file.generatedAt,
    items: deals.map(d => rssItem(d, errors)),
  })
}

/** Items per slice feed: the slice's first rows in the index's editorial order. */
export const SLICE_FEED_MAX = 50
/**
 * RSS for one category or store page: today's deals in that slice. A slice with nothing today
 * still gets a valid, empty feed (kept while the store was seen in the 30-day archive, always for
 * our categories), so a subscriber's reader sees "nothing today", never a 404 or yesterday's list.
 */
export function sliceFeed(kind: 'categoria' | 'tienda', slug: string, name: string, deals: Deal[], generatedAt: string): string {
  const page = `https://barato.si/${kind}/${slug}/`
  return channel({
    title: `barato.si — ${name}`,
    link: page,
    description: `Las ofertas de hoy ${kind === 'categoria' ? 'en la categoría' : 'de la tienda'} ${name}, en el orden del índice. Vacío cuando hoy no hay ninguna: no rellenamos con ofertas viejas.`,
    self: `https://barato.si${kind === 'categoria' ? categoryFeedPath(slug) : storeFeedPath(slug)}`,
    generatedAt,
    items: deals.slice(0, SLICE_FEED_MAX).map(d => rssItem(d, false)),
  })
}

/** Every slice feed to write this run, as [site path, body]. Pure. */
export function sliceFeeds(deals: Deal[], generatedAt: string, archived: readonly { store?: string | null }[] = []): [string, string][] {
  const today = landingPages(deals)
  const out: [string, string][] = []
  for (const c of categories) out.push([categoryFeedPath(c), sliceFeed('categoria', c, CATEGORY_NAME_ES[c], deals.filter(d => d.category === c), generatedAt)])
  const names = new Map(today.stores.map(s => [s.slug, s.name]))
  for (const d of archived) {
    const name = typeof d.store === 'string' ? d.store.trim() : '', slug = name ? storeSlug(name) : ''
    if (slug && !names.has(slug)) names.set(slug, name)
  }
  for (const [slug, name] of [...names].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push([storeFeedPath(slug), sliceFeed('tienda', slug, name, deals.filter(d => storeSlug(d.store ?? '') === slug), generatedAt)])
  }
  return out
}

/** /semana.xml: one item per ISO week (guid), refreshed every run while the week lasts. */
export function weekRss(w: WeekFile): string {
  const c = weekCopy(w, 'es')
  const item = `<item><title>${x(`${c.title}, ${c.range}`)}</title><link>https://barato.si/semana/</link><guid isPermaLink="false">barato.si/semana/${x(w.isoWeek)}</guid><pubDate>${new Date(w.generatedAt).toUTCString()}</pubDate><description>${x(weekText(w, 'es'))}</description></item>`
  return channel({
    title: 'barato.si — La semana de Don Centavo',
    link: 'https://barato.si/semana/',
    description: 'Resumen de los últimos siete días: caídas observadas, mínimos, posibles errores revisados y lo que aprendió el modelo. Una entrada por semana, actualizada en cada ejecución.',
    self: 'https://barato.si/semana.xml',
    generatedAt: w.generatedAt,
    items: [item],
  })
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
export interface Extras { highlights?: HighlightsFile; oracle?: OracleFile; week?: WeekFile }
const SITE = 'https://barato.si/'
/** Each Spanish route and its English twin. The UI owns the pages; the pipeline owns the sitemap. */
export const PAGES: [string, string][] = [['', 'en/'], ['errores/', 'en/errores/'], ['archivo/', 'en/archivo/'], ['api/', 'en/api/'], ['si/', 'en/si/'], ['semana/', 'en/week/'], ['anunciate/', 'en/advertise/'], ['privacidad/', 'en/privacy/']] // trailing slash: what GitHub Pages serves and what the UI canonicals use
/** Category and store pages with deals today, as [es, en] paths with the trailing slash. Same set the site prerenders. */
export function landingPairs(deals: readonly Pick<Deal, 'category' | 'store'>[]): [string, string][] {
  return landingPaths(landingPages(deals)).map(p => [p.es.slice(1) + '/', p.en.slice(1) + '/'])
}
export function sitemap(generatedAt: string, deals: readonly Pick<Deal, 'category' | 'store'>[] = []): string {
  const alternates = (es: string, en: string) => `<xhtml:link rel="alternate" hreflang="es" href="${SITE}${x(es)}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}${x(en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${x(es)}"/>`
  const pages = [...PAGES, ...landingPairs(deals)].flatMap(([es, en]) => [es, en].map(loc => `<url><loc>${SITE}${x(loc)}</loc><lastmod>${generatedAt}</lastmod>${alternates(es, en)}</url>`))
  const files = ['api/deals.json', 'api/errors.json', 'api/week.json', 'feed.xml', 'errors.xml', 'semana.xml'].map(path => `<url><loc>${SITE}${path}</loc><lastmod>${generatedAt}</lastmod></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${[...pages, ...files].join('')}</urlset>\n`
}
/** Published day archives in [from, before). An unreadable archive is skipped, never invented. */
export async function readArchives(dir: string, names: string[], from: string, before: string): Promise<{ date: string; deals: Deal[] }[]> {
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
  const archived = await readArchives(archive, names, cutoff, file.date)
  const recent = recentCandidates(archived, file.date, errors)
  // Slice feeds: every category, and every store with deals today or anywhere in the 30-day archive.
  const feeds = sliceFeeds(file.deals, file.generatedAt, archived.flatMap(a => a.deals))
  for (const dir of ['feeds/categoria', 'feeds/tienda']) await mkdir(join(root, dir), { recursive: true })
  const errorsFile: ErrorsFile = { date: file.date, generatedAt: file.generatedAt, deals: errors.map(compact), recent: recent.map(r => ({ date: r.date, deal: compact(r.deal) })), nearest: nearestMisses(all).map(compact) }
  const outputs: [string, string][] = [
    [join(archive, file.date + '.json'), json],
    [join(rawDir, file.date + '.json'), JSON.stringify(raw) + '\n'],
    [join(root, 'api/errors.json'), JSON.stringify(errorsFile) + '\n'],
    ...(extras.highlights ? [[join(root, 'api/highlights.json'), JSON.stringify(extras.highlights) + '\n'] as [string, string]] : []),
    ...(extras.oracle ? [[join(root, 'api/oracle.json'), JSON.stringify(extras.oracle) + '\n'] as [string, string]] : []),
    ...(extras.week ? [[join(root, 'api/week.json'), JSON.stringify(extras.week) + '\n'], [join(root, 'semana.xml'), weekRss(extras.week)]] as [string, string][] : []),
    ...feeds.map(([path, body]) => [join(root, path.slice(1)), body] as [string, string]),
    [join(root, 'feed.xml'), rss(file)],
    [join(root, 'errors.xml'), rss({ ...file, deals: errors }, true)],
    [join(root, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://barato.si/sitemap.xml\n'],
    [join(root, 'sitemap.xml'), sitemap(file.generatedAt, file.deals)],
    [join(root, 'llms.txt'), discovery(file, !!extras.week)],
    [join(root, 'api/index.json'), JSON.stringify({ latest: file.date, days }) + '\n'],
    [join(root, 'api/deals.json'), json],
  ]
  // Stage every complete document before replacing any published file; current JSON is last.
  try {
    for (const [path, body] of outputs) await writeFile(path + '.tmp', body, 'utf8')
    for (const [path] of outputs) await rename(path + '.tmp', path)
  } finally { for (const [path] of outputs) await rm(path + '.tmp', { force: true }) }
  // A store gone from the 30-day archive loses its feed; nothing in feeds/ that this run did not write survives it.
  const fed = new Set(feeds.map(([path]) => path))
  for (const kind of ['categoria', 'tienda']) for (const name of await readdir(join(root, 'feeds', kind))) {
    if (!fed.has(`/feeds/${kind}/${name}`)) await rm(join(root, 'feeds', kind, name), { force: true })
  }
  for (const dir of [archive, rawDir]) for (const name of await readdir(dir)) {
    if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) < cutoff) await rm(join(dir, name))
  }
}
/** Today's slice feeds (the slices with a landing page), as absolute URLs with their page names. */
export function feedList(deals: readonly Pick<Deal, 'category' | 'store'>[]): string[] {
  const set = landingPages(deals)
  return [
    ...set.categories.map(c => `https://barato.si${categoryFeedPath(c.slug)} — ${CATEGORY_NAME_ES[c.category]} (${c.count})`),
    ...set.stores.map(s => `https://barato.si${storeFeedPath(s.slug)} — ${s.name} (${s.count})`),
  ]
}
function discovery(file: DealsFile, week = false): string {
  const feeds = feedList(file.deals)
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
https://barato.si/feed.xml — RSS 2.0, hasta 30 ofertas.${week ? `
https://barato.si/api/week.json — La semana de Don Centavo: { version: 1, generatedAt, from, to, isoWeek, days, products, drops, lows, errors, forecast, rule }, rehecho en cada ejecución con los últimos 7 días UTC publicados (hoy incluido), el registro de precios y el oráculo. drops: la mayor caída de cada producto frente al día anterior observado (>= 10 %). lows: publicados en o bajo el mínimo de al menos 3 días observados. errors: candidatos (>= 40) de la semana, vueltos a puntuar con las reglas de hoy; note es la nota en caché del clasificador, si existe. Cualquier lista puede estar vacía.
https://barato.si/semana.xml — RSS 2.0 del resumen semanal: una entrada por semana ISO (guid), actualizada en cada ejecución. Página: https://barato.si/semana/ y https://barato.si/en/week/.` : ''}
https://barato.si/feeds/categoria/<slug>.xml y https://barato.si/feeds/tienda/<slug>.xml — RSS 2.0 por categoría y por tienda, las ofertas de hoy de esa página (hasta 50). Cuando hoy no hay ninguna, el feed sigue ahí, vacío (las categorías siempre; una tienda, mientras siga en el archivo de 30 días).${feeds.length ? `

## Feeds de hoy
${feeds.join('\n')}` : ''}

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
Endpoints: /api/deals.json (version 3, up to 250 deals, error candidates first), /api/errors.json (errorScore >= 40, may be empty; plus recent: past candidates from the published 30-day archives, and nearest: today's 5 highest scores below 40, which are not errors), /api/highlights.json (carousel slots, each with its rule stated in noteEn), /api/oracle.json (the .si oracle), /api/deals/YYYY-MM-DD.json, /api/index.json, /feed.xml, /errors.xml.${week ? ' Weekly digest: /api/week.json and /semana.xml (page at /en/week).' : ''} One RSS feed per category and per store: /feeds/categoria/<spanish slug>.xml and /feeds/tienda/<slug>.xml, listed above; their text is Spanish.
errorScore is a heuristic from 0 to 100: 70+ is a probable error, 40+ a candidate to review. It is not a calibrated probability and confirms nothing. Thresholds are never lowered to fill a page.
The .si oracle answers "buy now or wait?". pDrop is the probability that an observed price within 14 days is at least 5% below today's, from a beta-binomial empirical-Bayes model: a Beta prior per category fitted by method of moments across our price ledger, updated with the product's own history. verdict is espera (wait, pDrop >= 0.5), compra (buy, < 0.5) or aprendiendo (learning: fewer than 2 completed windows of its own, or too little pooled data). Every prediction is logged and resolved against the ledger after its horizon; scorecard reports the model's Brier score against a base-rate baseline and 5 calibration buckets. An empty scorecard means nothing has resolved yet. The ledger started in October 2026 and holds only prices we observed.
Cite barato.si and the original source. Cache responses; one request every three hours is enough. barato.si is a Formship LLC project (https://formship.io).
`
}
