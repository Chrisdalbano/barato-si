// Copy shared by the home page's API section and /api.

export const SITE = 'https://barato.si'

export const ENDPOINTS = [
  { path: '/api/deals.json', what: 'Las ofertas de hoy: hasta 150, ordenadas por puntuación.' },
  { path: '/api/deals/YYYY-MM-DD.json', what: 'Un día concreto. Se guardan los últimos 30 días (UTC).' },
  { path: '/api/index.json', what: '{ latest, days }: la fecha más reciente y todas las disponibles, de nueva a vieja.' },
  { path: '/feed.xml', what: 'RSS 2.0 con las 30 primeras, con el contenido original de la fuente.' },
  { path: '/llms.txt', what: 'Descripción en texto plano para agentes y modelos.' },
]

export const CURL_EXAMPLE = `curl -s https://barato.si/api/deals.json \\
  | jq '.deals[] | select(.flag != "normal") | {title, price, currency, url}'`

export const FETCH_EXAMPLE = `const res = await fetch('https://barato.si/api/deals.json')
const { generatedAt, deals } = await res.json()

const errores = deals.filter(d => d.flag === 'error-probable')
console.log(generatedAt, errores.length, deals[0]?.title)`

export const SCHEMA: { field: string; type: string; note: string }[] = [
  { field: 'id', type: 'string', note: 'Estable entre días para la misma oferta.' },
  { field: 'title', type: 'string', note: 'Título original de la fuente, sin traducir.' },
  { field: 'url', type: 'string', note: 'Enlace original a la oferta, tal cual.' },
  { field: 'store', type: 'string', note: 'Tienda: "Amazon", "Macy\'s"…' },
  { field: 'source / sourceUrl', type: 'string', note: 'De dónde salió y enlace a esa fuente.' },
  { field: 'currency', type: 'string', note: 'ISO 4217.' },
  { field: 'price', type: 'number', note: 'Precio de oferta, en unidades de la moneda.' },
  { field: 'listPrice', type: 'number | null', note: 'Precio de referencia, si la fuente lo da.' },
  { field: 'discountPct', type: 'number | null', note: '0–100. null sin precio de referencia.' },
  { field: 'publishedAt / foundAt', type: 'ISO 8601', note: 'Publicación en la fuente / primera vez vista.' },
  { field: 'score', type: 'number', note: '0–100. Puntuación de barato.si.' },
  { field: 'flag', type: '"error-probable" | "chollo" | "normal"', note: 'Etiqueta de barato.si.' },
  { field: 'reasons', type: 'string[]', note: 'Por qué, en español. Análisis propio.' },
  { field: 'image / category', type: 'string | null', note: 'Si la fuente los da.' },
  { field: 'syndication', type: 'object?', note: 'Contenido original de la fuente, sin tocar, para atribución.' },
]
