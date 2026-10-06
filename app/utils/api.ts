// Copy shared by the home page's API section and /api.

export const SITE = 'https://barato.si'

export const ENDPOINTS = [
  { path: '/api/deals.json', what: 'Las ofertas de hoy (hasta 400), en orden: las 30 primeras repartidas entre fuentes, el resto por puntuación.' },
  { path: '/api/errors.json', what: '{ date, generatedAt, deals }: las ofertas de hoy con errorScore de 40 o más, de más a menos sospechosa.' },
  { path: '/api/deals/YYYY-MM-DD.json', what: 'Un día concreto. Se guardan los últimos 30 días (UTC).' },
  { path: '/api/index.json', what: '{ latest, days }: la fecha más reciente y todas las disponibles, de nueva a vieja.' },
  { path: '/api/raw/YYYY-MM-DD.json', what: 'El contenido sindicado original de cada día (itemXml incluido), solo para atribución.' },
  { path: '/feed.xml', what: 'RSS 2.0 con las 30 primeras, con el contenido original de la fuente.' },
  { path: '/errors.xml', what: 'RSS 2.0 con los posibles errores de precio del día.' },
  { path: '/llms.txt', what: 'Descripción en texto plano para agentes y modelos.' },
]

export const CURL_EXAMPLE = `curl -s https://barato.si/api/errors.json \\
  | jq '.deals[] | {errorScore, title, price, currency, link: (.storeUrl // .url)}'`

export const FETCH_EXAMPLE = `const res = await fetch('https://barato.si/api/deals.json')
const { generatedAt, deals } = await res.json()

// La página de la tienda cuando se conoce; si no, el enlace de la fuente.
const link = d => d.storeUrl ?? d.url
const errores = deals.filter(d => (d.errorScore ?? 0) >= 70)
console.log(generatedAt, errores.length, deals[0] && link(deals[0]))`

export const SCHEMA: { field: string; type: string; note: string }[] = [
  { field: 'id', type: 'string', note: 'Estable entre días para la misma oferta.' },
  { field: 'title', type: 'string', note: 'Título original de la fuente, sin traducir.' },
  { field: 'url', type: 'string', note: 'Enlace que da la fuente, tal cual: la tienda, o el enlace que exige el agregador.' },
  { field: 'storeUrl', type: 'string | null', note: 'Página de la propia tienda, cuando se conoce y se puede enlazar. La web la prefiere a url.' },
  { field: 'store', type: 'string', note: 'Tienda: "Amazon", "Macy\'s"…' },
  { field: 'storeDomain', type: 'string | null', note: 'Dominio de la tienda, p. ej. "amazon.com".' },
  { field: 'source / sourceUrl', type: 'string', note: 'De dónde salió y enlace a esa fuente.' },
  { field: 'currency', type: 'string', note: 'ISO 4217.' },
  { field: 'price', type: 'number', note: 'Precio de oferta, en unidades de la moneda. 0 = gratis.' },
  { field: 'listPrice', type: 'number | null', note: 'Precio de referencia, si la fuente lo da.' },
  { field: 'discountPct', type: 'number | null', note: '0–100. null sin precio de referencia.' },
  { field: 'image', type: 'string | null', note: 'Imagen del producto que da la fuente (https). null si no hay.' },
  { field: 'category', type: 'string | null', note: 'Categoría propia (videojuegos, informatica, hogar…); en archivos viejos, la de la fuente.' },
  { field: 'publishedAt / foundAt', type: 'ISO 8601', note: 'Publicación en la fuente / primera vez vista.' },
  { field: 'score', type: 'number', note: '0–100. Puntuación de barato.si: qué tan buena es la rebaja.' },
  { field: 'errorScore', type: 'number', note: '0–100. Qué tan probable es que sea un error de precio y no una rebaja buscada. Independiente de score. 0 en archivos v1.' },
  { field: 'errorSignals', type: 'string[]', note: 'Las señales detrás de errorScore, en español, la más fuerte primero.' },
  { field: 'flag', type: '"error-probable" | "chollo" | "normal"', note: 'Etiqueta de barato.si; "error-probable" cuando errorScore ≥ 70. En la web: «Posible error de precio», «Baratísimo» o nada.' },
  { field: 'reasons', type: 'string[]', note: 'Por qué, en español. Análisis propio.' },
  { field: 'history', type: 'object?', note: '{ days, minPrice, maxPrice, firstSeen }: lo que el archivo vio de esta oferta en días anteriores. Ausente si es nueva hoy.' },
  { field: 'ai', type: 'object?', note: '{ product, category, verdict, confidence, note, model }: clasificación opcional de un modelo pequeño, solo en candidatas. Ausente si no corrió.' },
  { field: 'syndication', type: 'object?', note: 'Atribución de la fuente. El itemXml original ya no va aquí: está en /api/raw/YYYY-MM-DD.json.' },
]

/** Top-level fields of every DealsFile, for the schema note. */
export const FILE_FIELDS = '{ version, date, generatedAt, count, sources[], classifier?, deals[] }'
