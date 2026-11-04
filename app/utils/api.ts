// Copy shared by the home page's API section and /api, in both languages.
import type { Locale } from './locale'

export const SITE = 'https://barato.si'

export const ENDPOINTS = [
  { path: '/api/deals.json', what: 'Las ofertas de hoy (hasta 400) que pasaron el filtro de interés, en orden editorial: primero las candidatas a error de precio.' },
  { path: '/api/errors.json', what: '{ date, generatedAt, deals, recent?, nearest? }: las ofertas de hoy con errorScore de 40 o más. Puede estar vacío, y eso es un resultado.' },
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

// ---- English --------------------------------------------------------------

export const ENDPOINTS_EN = [
  { path: '/api/deals.json', what: "Today's offers (up to 400) that passed the interest filter, in editorial order: price-error candidates first." },
  { path: '/api/errors.json', what: "{ date, generatedAt, deals, recent?, nearest? }: today's offers with an errorScore of 40 or more. It can be empty, and that is a result." },
  { path: '/api/deals/YYYY-MM-DD.json', what: 'One specific day. The last 30 days (UTC) are kept.' },
  { path: '/api/index.json', what: '{ latest, days }: the most recent date and every available one, newest first.' },
  { path: '/api/raw/YYYY-MM-DD.json', what: "Each day's original syndicated content (itemXml included), for attribution only." },
  { path: '/feed.xml', what: 'RSS 2.0 with the top 30, carrying the source\'s original content.' },
  { path: '/errors.xml', what: "RSS 2.0 with the day's possible price errors." },
  { path: '/llms.txt', what: 'A plain-text description for agents and models.' },
]

export const FETCH_EXAMPLE_EN = `const res = await fetch('https://barato.si/api/deals.json')
const { generatedAt, deals } = await res.json()

// The store's own page when known; otherwise the source's link.
const link = d => d.storeUrl ?? d.url
// Probable errors backed by an observed price, not just the seller's list price.
const errors = deals.filter(d => (d.errorScore ?? 0) >= 70 && d.reference?.kind === 'ledger')
console.log(generatedAt, errors.length, errors[0] && link(errors[0]))`

const SCHEMA_NOTE_EN: Record<string, string> = {
  id: 'Stable across days for the same offer.',
  title: "The source's original title, untranslated.",
  url: 'The link the source gives, as is: the store, or the link the aggregator requires.',
  storeUrl: "The store's own page, when known and linkable. The site prefers it over url.",
  store: 'Store: "Amazon", "Macy\'s"…',
  storeDomain: 'Store domain, e.g. "amazon.com".',
  direct: 'v3. true only when the main link goes straight to the product page at the store.',
  productKey: 'v3. Stable product identity across sources: asin:B0…, bestbuy:123, shopify:domain:handle, steam:440, url:<id>.',
  brand: 'v3. Canonical brand when recognized. null is not a judgment: it just earns no brand points.',
  'source / sourceUrl': 'Where it came from, and a link to that source.',
  currency: 'ISO 4217.',
  price: 'Offer price, in currency units. 0 = free.',
  listPrice: 'List price, if the source gives one. It is what the seller says; it is not verified.',
  discountPct: '0–100 against listPrice. null without a list price.',
  reference: 'v3. { price, kind, observations?, asOf?, note }: the best evidence of what it usually costs. kind, strongest first: ledger (median of observed days), cross-store, curated, source-previous, list. Absent when there is none. note is in Spanish.',
  referenceDiscountPct: 'v3. 0–100 against reference. This, not discountPct, is what the error score uses.',
  image: 'Product image from the source (https). null if there is none.',
  category: 'Our own category (videojuegos, informatica, hogar…, Spanish slugs); in old files, the source\'s.',
  'publishedAt / foundAt': 'Published at the source / first seen.',
  score: '0–100. barato.si\'s score: how good the discount is.',
  errorScore: '0–100. How likely it is a price error rather than an intended sale. Heuristic: in v3 it weighs depth against reference by what its evidence is worth. Independent of score. 0 in v1 files.',
  errorSignals: 'The signals behind errorScore, in Spanish, strongest first.',
  'interest / interestSignals': 'v3. 0–100: whether it deserves a reader\'s attention, and why, in Spanish.',
  seenIn: 'v3. Sources that carried this product in this run. Two or more is corroboration.',
  staffPick: "v3. DealNews editors' pick.",
  flag: 'barato.si\'s label; "error-probable" when errorScore ≥ 70. On the web: "Possible price error", "Dirt cheap" or nothing.',
  reasons: 'Why, in Spanish. Our own analysis.',
  history: '{ days, minPrice, maxPrice, firstSeen }: what the archive saw of this offer on earlier days. Absent if it is new today.',
  ai: '{ product, category, verdict, confidence, note, model }: optional classification by a small model, candidates only. Absent if it did not run.',
  syndication: "The source's attribution. The original itemXml no longer travels here: it is in /api/raw/YYYY-MM-DD.json.",
}

export function endpointsFor(loc: Locale = 'es') {
  return loc === 'en' ? ENDPOINTS_EN : ENDPOINTS
}
export function schemaFor(loc: Locale = 'es') {
  return loc === 'en' ? SCHEMA.map(r => ({ ...r, note: SCHEMA_NOTE_EN[r.field] ?? r.note })) : SCHEMA
}
export function fetchExampleFor(loc: Locale = 'es') {
  return loc === 'en' ? FETCH_EXAMPLE_EN : FETCH_EXAMPLE
}
