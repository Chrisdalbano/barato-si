// Copy shared by the home page's API section and /api.

export const SITE = 'https://barato.si'

export const ENDPOINTS = [
  { path: '/api/deals.json', what: 'Las ofertas de hoy (hasta 400) que pasaron el filtro de interés, en orden editorial: primero las candidatas a error de precio.' },
  { path: '/api/errors.json', what: '{ date, generatedAt, deals }: las ofertas de hoy con errorScore de 40 o más. Puede estar vacío, y eso es un resultado.' },
  { path: '/api/deals/YYYY-MM-DD.json', what: 'Un día concreto. Se guardan los últimos 30 días (UTC).' },
  { path: '/api/index.json', what: '{ latest, days }: la fecha más reciente y todas las disponibles, de nueva a vieja.' },
  { path: '/api/raw/YYYY-MM-DD.json', what: 'El contenido sindicado original de cada día (itemXml incluido), solo para atribución.' },
  { path: '/feed.xml', what: 'RSS 2.0 con las 30 primeras, con el contenido original de la fuente.' },
  { path: '/errors.xml', what: 'RSS 2.0 con los posibles errores de precio del día.' },
  { path: '/llms.txt', what: 'Descripción en texto plano para agentes y modelos.' },
]

export const CURL_EXAMPLE = `curl -s https://barato.si/api/errors.json \\
  | jq '.deals[] | {errorScore, title, price, reference, link: (.storeUrl // .url)}'`

export const FETCH_EXAMPLE = `const res = await fetch('https://barato.si/api/deals.json')
const { generatedAt, deals } = await res.json()

// La página de la tienda cuando se conoce; si no, el enlace de la fuente.
const link = d => d.storeUrl ?? d.url
// Errores probables con un precio observado detrás, no solo el de lista del vendedor.
const errores = deals.filter(d => (d.errorScore ?? 0) >= 70 && d.reference?.kind === 'ledger')
console.log(generatedAt, errores.length, errores[0] && link(errores[0]))`

export const SCHEMA: { field: string; type: string; note: string }[] = [
  { field: 'id', type: 'string', note: 'Estable entre días para la misma oferta.' },
  { field: 'title', type: 'string', note: 'Título original de la fuente, sin traducir.' },
  { field: 'url', type: 'string', note: 'Enlace que da la fuente, tal cual: la tienda, o el enlace que exige el agregador.' },
  { field: 'storeUrl', type: 'string | null', note: 'Página de la propia tienda, cuando se conoce y se puede enlazar. La web la prefiere a url.' },
  { field: 'store', type: 'string', note: 'Tienda: "Amazon", "Macy\'s"…' },
  { field: 'storeDomain', type: 'string | null', note: 'Dominio de la tienda, p. ej. "amazon.com".' },
  { field: 'direct', type: 'boolean?', note: 'v3. true solo cuando el enlace principal va directo a la página del producto en la tienda.' },
  { field: 'productKey', type: 'string?', note: 'v3. Identidad estable del producto entre fuentes: asin:B0…, bestbuy:123, shopify:dominio:handle, steam:440, url:<id>.' },
  { field: 'brand', type: 'string | null ?', note: 'v3. Marca canónica cuando se reconoce. null no es un juicio: solo no suma puntos de marca.' },
  { field: 'source / sourceUrl', type: 'string', note: 'De dónde salió y enlace a esa fuente.' },
  { field: 'currency', type: 'string', note: 'ISO 4217.' },
  { field: 'price', type: 'number', note: 'Precio de oferta, en unidades de la moneda. 0 = gratis.' },
  { field: 'listPrice', type: 'number | null', note: 'Precio de lista, si la fuente lo da. Es lo que dice el vendedor; no está verificado.' },
  { field: 'discountPct', type: 'number | null', note: '0–100 contra listPrice. null sin precio de lista.' },
  { field: 'reference', type: 'object?', note: 'v3. { price, kind, observations?, asOf?, note }: la mejor evidencia de lo que suele costar. kind, de más a menos fuerte: ledger (mediana de días observados), cross-store, curated, source-previous, list. Ausente si no hay ninguna.' },
  { field: 'referenceDiscountPct', type: 'number | null ?', note: 'v3. 0–100 contra reference. Es lo que usa la puntuación de error, no discountPct.' },
  { field: 'image', type: 'string | null', note: 'Imagen del producto que da la fuente (https). null si no hay.' },
  { field: 'category', type: 'string | null', note: 'Categoría propia (videojuegos, informatica, hogar…); en archivos viejos, la de la fuente.' },
  { field: 'publishedAt / foundAt', type: 'ISO 8601', note: 'Publicación en la fuente / primera vez vista.' },
  { field: 'score', type: 'number', note: '0–100. Puntuación de barato.si: qué tan buena es la rebaja.' },
  { field: 'errorScore', type: 'number', note: '0–100. Qué tan probable es que sea un error de precio y no una rebaja buscada. Heurística: en v3 pesa la profundidad contra reference según lo que vale su evidencia. Independiente de score. 0 en archivos v1.' },
  { field: 'errorSignals', type: 'string[]', note: 'Las señales detrás de errorScore, en español, la más fuerte primero.' },
  { field: 'interest / interestSignals', type: 'number? / string[]?', note: 'v3. 0–100: si merece la atención de un lector, y por qué, en español.' },
  { field: 'seenIn', type: 'string[]?', note: 'v3. Fuentes que traían este producto en esta pasada. Dos o más es corroboración.' },
  { field: 'staffPick', type: 'boolean?', note: 'v3. Elección editorial de DealNews.' },
  { field: 'flag', type: '"error-probable" | "chollo" | "normal"', note: 'Etiqueta de barato.si; "error-probable" cuando errorScore ≥ 70. En la web: «Posible error de precio», «Baratísimo» o nada.' },
  { field: 'reasons', type: 'string[]', note: 'Por qué, en español. Análisis propio.' },
  { field: 'history', type: 'object?', note: '{ days, minPrice, maxPrice, firstSeen }: lo que el archivo vio de esta oferta en días anteriores. Ausente si es nueva hoy.' },
  { field: 'ai', type: 'object?', note: '{ product, category, verdict, confidence, note, model }: clasificación opcional de un modelo pequeño, solo en candidatas. Ausente si no corrió.' },
  { field: 'syndication', type: 'object?', note: 'Atribución de la fuente. El itemXml original ya no va aquí: está en /api/raw/YYYY-MM-DD.json.' },
]

/** Top-level fields of every DealsFile, for the schema note. */
export const FILE_FIELDS = '{ version, date, generatedAt, count, sources[], classifier?, gate?, deals[] }'
