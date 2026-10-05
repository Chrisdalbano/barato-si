import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Deal, DealsFile } from '../lib/types.ts'
import { normalizeSource, type Source } from '../lib/normalize.ts'
import { dedupe } from '../lib/dedupe.ts'
import { xmlEscape as x } from '../lib/feeds.ts'
import { formatMoney } from '../lib/format.ts'

function sourceErrorEs(source: Source, error: string): string {
  if (source.disabled) return 'Fuente desactivada; pendiente de revisión.'
  if (/Blocked by robots/.test(error)) return 'La fuente no permite la consulta automática.'
  if (/robots.txt/.test(error)) return 'No se pudo comprobar el permiso de consulta.'
  if (/Redirect refused/.test(error)) return 'La fuente redirige a otra dirección; pendiente de revisión.'
  if (/schema|XML|JSON/i.test(error)) return 'La fuente devolvió datos que no se pudieron interpretar.'
  return 'No se pudieron obtener las ofertas de esta fuente.'
}

export async function collect(sources: Source[], read: (source: Source) => Promise<string>, now: Date, previous: Deal[] = []): Promise<DealsFile> {
  const deals: Deal[] = []
  const outcomes: DealsFile['sources'] = []
  for (const source of sources) {
    try {
      const found = normalizeSource(source, await read(source), now, previous)
      deals.push(...found)
      outcomes.push({ name: source.name, ok: true, count: found.length })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown source failure'
      outcomes.push({ name: source.name, ok: false, count: 0, error, errorEs: sourceErrorEs(source, error) })
    }
  }
  const ranked = balanceRanking(dedupe(deals)).slice(0, 150)
  return { date: now.toISOString().slice(0, 10), generatedAt: now.toISOString(), count: ranked.length, sources: outcomes, deals: ranked }
}

// Alternate the best non-game and game offers; at most 15 games in the top 30
// when 15 other offers exist. Fill shortages instead of hiding valid offers.
export function balanceRanking(ranked: Deal[]): Deal[] {
  const games = ranked.filter(d => /videojuegos|games/i.test(d.category || ''))
  const other = ranked.filter(d => !/videojuegos|games/i.test(d.category || ''))
  const top: Deal[] = []
  for (let i = 0; i < 15; i++) {
    if (other[i]) top.push(other[i]!)
    if (games[i]) top.push(games[i]!)
  }
  const selected = new Set(top.map(d => d.id))
  return [...top, ...ranked.filter(d => !selected.has(d.id))]
}

export function rss(file: DealsFile): string {
  const items = file.deals.slice(0, 30).map(d => d.syndication?.itemXml || `<item><title>${x(d.title)}</title><link>${x(d.url)}</link><guid isPermaLink="false">${x(d.id)}</guid><pubDate>${new Date(d.publishedAt).toUTCString()}</pubDate><description>${x(`${formatMoney(d.price)} ${d.currency}. ${d.reasons.join('. ')}. Fuente: ${d.source}`)}</description><source url="${x(d.sourceUrl)}">${x(d.source)}</source></item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dealnews="https://www.dealnews.com/ns/rss/1.0.htm" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>barato.si — ofertas del día</title><link>https://barato.si/</link><description>Ofertas seleccionadas cada día. Contenido y enlaces originales de cada fuente. La clasificación de barato.si es independiente.</description><language>es</language><lastBuildDate>${new Date(file.generatedAt).toUTCString()}</lastBuildDate><atom:link href="https://barato.si/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>\n`
}

export async function readPrevious(root: string): Promise<Deal[]> {
  const known = new Map<string, Deal>()
  const remember = (deals: Deal[]) => {
    for (const d of deals) if (!known.has(d.id) || d.foundAt < known.get(d.id)!.foundAt) known.set(d.id, d)
  }
  try {
    remember(JSON.parse(await readFile(join(root, 'api/deals.json'), 'utf8')).deals || [])
    const archive = join(root, 'api/deals')
    for (const name of await readdir(archive)) {
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) remember(JSON.parse(await readFile(join(archive, name), 'utf8')).deals || [])
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  return [...known.values()]
}

export async function writeOutputs(root: string, file: DealsFile): Promise<void> {
  const archive = join(root, 'api/deals')
  await mkdir(archive, { recursive: true })
  async function atomic(path: string, body: string) {
    await writeFile(path + '.tmp', body, 'utf8')
    await rename(path + '.tmp', path)
  }
  const json = JSON.stringify(file, null, 2) + '\n'
  await atomic(join(archive, file.date + '.json'), json)
  const cutoff = new Date(Date.parse(file.date + 'T00:00:00Z') - 29 * 86400000).toISOString().slice(0, 10)
  const days: string[] = []
  for (const name of await readdir(archive)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue
    const day = name.slice(0, 10)
    if (day < cutoff) await rm(join(archive, name))
    else if (day <= file.date) days.push(day)
  }
  days.sort().reverse()
  await atomic(join(root, 'api/deals.json'), json)
  await atomic(join(root, 'api/index.json'), JSON.stringify({ latest: file.date, days }, null, 2) + '\n')
  await atomic(join(root, 'feed.xml'), rss(file))
  await atomic(join(root, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://barato.si/sitemap.xml\n')
  await atomic(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://barato.si/</loc><lastmod>${file.generatedAt}</lastmod></url></urlset>\n`)
  await atomic(join(root, 'llms.txt'), `# barato.si — barato, sí
Ofertas y posibles errores de precio, seleccionados cada día. API JSON gratuita, sin autenticación.
Actualización UTC: ${file.generatedAt}. Programación diaria: 11:00 UTC.

## Endpoints
https://barato.si/api/deals.json — DealsFile actual, hasta 150 ofertas con equilibrio de categorías en las primeras 30.
https://barato.si/api/deals/YYYY-MM-DD.json — archivo diario, últimos 30 días UTC.
https://barato.si/api/index.json — { latest: fecha YYYY-MM-DD, days: fechas disponibles en orden descendente }.
https://barato.si/feed.xml — RSS 2.0, hasta 30 ofertas.

## Esquema
DealsFile: { date: string, generatedAt: ISO8601, count: number, sources: [{ name: string, ok: boolean, count: number, error?: string, errorEs?: string }], deals: Deal[] }.
Deal: { id: string, title: string, url: string, store: string, source: string, sourceUrl: string, currency: ISO4217, price: number, listPrice: number|null, discountPct: number|null, image: string|null, category: string|null, publishedAt: ISO8601, foundAt: ISO8601, score: number (0–100), flag: string (clasificación interna; mostrar como Error probable, Baratísimo o Normal), reasons: string[], sourceSignal?: number, syndication?: { attribution: string, feedUrl: string, itemXml: string, descriptionHtml: string } }.
Los precios se expresan en unidades de la moneda indicada. Un precio desconocido se omite, nunca se convierte en cero. Los porcentajes sin precio de lista no se tratan como verificados.

## Atribución y uso razonable
Fuentes activas: CheapShark (enlaces de redirección obligatorios), Steam, Epic y DealNews (https://www.dealnews.com/pages/rss.html). Conserva el contenido original de syndication y los enlaces con sus códigos; atribuye a DealNews al mostrarlo. No uses su contenido en extensiones públicas de navegador. La clasificación y sus razones son análisis independiente de barato.si.
Cita barato.si y la fuente original. Conserva los enlaces y la atribución. Almacena la respuesta en caché; basta una consulta al día. No revendas el contenido de las fuentes ni lo uses para entrenar modelos sin permiso de sus titulares.
Las ofertas pueden caducar y tener condiciones, cupones o requisitos de membresía. Comprueba las condiciones en la fuente. «Error probable» es una señal, no una confirmación. El idioma original de los títulos se conserva.
`)
}
