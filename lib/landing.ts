// Long-tail landing pages: one per category and one per store with deals today.
// Pure and dependency-free, shared by the pipeline (sitemap, IndexNow) and the
// site (routes, links, prerender list), so the pages that exist and the URLs
// that are announced are always the same set.
import type { DealCategory } from './types.ts'

/** English URL slug for each of our categories. The Spanish slug is the category value itself. */
export const CATEGORY_SLUG_EN: Record<DealCategory, string> = {
  videojuegos: 'video-games',
  informatica: 'computers',
  electronica: 'electronics',
  hogar: 'home',
  cocina: 'kitchen',
  herramientas: 'tools',
  ropa: 'clothing',
  deporte: 'sports',
  juguetes: 'toys',
  belleza: 'beauty',
  alimentacion: 'food',
  software: 'software',
  servicios: 'services',
  otros: 'other',
}
const CATEGORY_FROM_EN: Record<string, DealCategory> = Object.fromEntries(
  Object.entries(CATEGORY_SLUG_EN).map(([es, en]) => [en, es as DealCategory]),
)

export const isCategory = (value: unknown): value is DealCategory =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_SLUG_EN, value)

/** Spanish category slug from either language's slug, or null when unknown. */
export function categoryFromSlug(slug: string, loc: 'es' | 'en' = 'es'): DealCategory | null {
  if (loc === 'en') return CATEGORY_FROM_EN[slug] ?? null
  return isCategory(slug) ? slug : null
}

/** URL slug for a store name: ASCII, lowercase, hyphenated. "Woot! An Amazon Company" -> "woot-an-amazon-company". */
export function storeSlug(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

/** DOM id for a deal row, stable across builds (ids are the pipeline's hashes). */
export function dealAnchor(id: string): string {
  return 'd-' + id.replace(/[^A-Za-z0-9_-]/g, '-')
}

export interface CategoryPage { category: DealCategory; slug: string; enSlug: string; count: number }
export interface StorePage { slug: string; name: string; count: number }
export interface LandingSet { categories: CategoryPage[]; stores: StorePage[] }

type Slice = { category?: string | null; store?: string | null }

/**
 * Categories and stores that have at least one deal in `deals`. Only our own
 * category values get a page (older files carry source labels). Stores whose
 * names slug to the same value share one page, named after the most common
 * spelling. Sorted by count, then slug, so the order is stable.
 */
export function landingPages(deals: readonly Slice[]): LandingSet {
  const cats = new Map<DealCategory, number>()
  const stores = new Map<string, Map<string, number>>()
  for (const d of deals) {
    if (isCategory(d.category)) cats.set(d.category, (cats.get(d.category) ?? 0) + 1)
    const name = typeof d.store === 'string' ? d.store.trim() : ''
    const slug = name ? storeSlug(name) : ''
    if (!slug) continue
    const names = stores.get(slug) ?? new Map<string, number>()
    names.set(name, (names.get(name) ?? 0) + 1)
    stores.set(slug, names)
  }
  const byCount = <T extends { count: number; slug: string }>(a: T, b: T) => b.count - a.count || a.slug.localeCompare(b.slug)
  return {
    categories: [...cats].map(([category, count]) => ({ category, slug: category, enSlug: CATEGORY_SLUG_EN[category], count })).sort(byCount),
    stores: [...stores].map(([slug, names]) => {
      const ranked = [...names].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      return { slug, name: ranked[0]![0], count: ranked.reduce((n, [, c]) => n + c, 0) }
    }).sort(byCount),
  }
}

/** Site paths (no trailing slash) of a category page in each language. */
export const categoryPaths = (p: Pick<CategoryPage, 'slug' | 'enSlug'>) => ({ es: `/categoria/${p.slug}`, en: `/en/category/${p.enSlug}` })
/** Site paths (no trailing slash) of a store page in each language. */
export const storePaths = (p: Pick<StorePage, 'slug'>) => ({ es: `/tienda/${p.slug}`, en: `/en/store/${p.slug}` })

/** Every landing page as a Spanish/English path pair. */
export function landingPaths(set: LandingSet): { es: string; en: string }[] {
  return [...set.categories.map(categoryPaths), ...set.stores.map(storePaths)]
}

/** Spanish display name of each category (the site's CATEGORY_LABEL reads this). */
export const CATEGORY_NAME_ES: Record<DealCategory, string> = {
  videojuegos: 'Videojuegos',
  informatica: 'Informática',
  electronica: 'Electrónica',
  hogar: 'Hogar',
  cocina: 'Cocina',
  herramientas: 'Herramientas',
  ropa: 'Ropa',
  deporte: 'Deporte',
  juguetes: 'Juguetes',
  belleza: 'Belleza',
  alimentacion: 'Alimentación',
  software: 'Software',
  servicios: 'Servicios',
  otros: 'Otros',
}

/**
 * One dry line per category page: what it lists and what barato checks. Not
 * every row has a reference price (some have none), hence "cuando la hay".
 * Every row is scored for a possible price error, so that claim holds for all.
 */
export const CATEGORY_INTRO: Record<DealCategory, { es: string; en: string }> = {
  videojuegos: {
    es: 'Juegos de PC y consola rebajados en Steam, GOG, Epic y otras tiendas digitales, comparados con un precio de referencia cuando lo hay.',
    en: 'PC and console games on sale at Steam, GOG, Epic and other digital stores, compared with a reference price when there is one.',
  },
  informatica: {
    es: 'Portátiles, monitores, almacenamiento, periféricos y redes, comparados con un precio de referencia cuando lo hay y revisados por si son un error de precio.',
    en: 'Laptops, monitors, storage, peripherals and networking, compared with a reference price when there is one and checked for a possible price error.',
  },
  electronica: {
    es: 'Televisores, audio, móviles, tabletas, cámaras y cargadores, comparados con un precio de referencia cuando lo hay y revisados por si son un error de precio.',
    en: 'TVs, audio, phones, tablets, cameras and chargers, compared with a reference price when there is one and checked for a possible price error.',
  },
  hogar: {
    es: 'Muebles, ropa de cama, limpieza, climatización, jardín y artículos para bebé, comparados con un precio de referencia cuando lo hay.',
    en: 'Furniture, bedding, cleaning, heating and cooling, garden and baby gear, compared with a reference price when there is one.',
  },
  cocina: {
    es: 'Pequeños electrodomésticos, menaje, cafeteras, parrillas y termos, comparados con un precio de referencia cuando lo hay.',
    en: 'Small appliances, cookware, coffee makers, grills and drinkware, compared with a reference price when there is one.',
  },
  herramientas: {
    es: 'Herramientas eléctricas y de mano, cortacéspedes, compresores y accesorios para el coche, comparados con un precio de referencia cuando lo hay.',
    en: 'Power and hand tools, mowers, compressors and car accessories, compared with a reference price when there is one.',
  },
  ropa: {
    es: 'Ropa, calzado, mochilas y maletas, comparados con un precio de referencia cuando lo hay.',
    en: 'Clothing, shoes, backpacks and luggage, compared with a reference price when there is one.',
  },
  deporte: {
    es: 'Bicicletas, fitness, camping, pesca y deportes de raqueta, comparados con un precio de referencia cuando lo hay.',
    en: 'Bikes, fitness, camping, fishing and racket sports, compared with a reference price when there is one.',
  },
  juguetes: {
    es: 'LEGO, juegos de mesa, muñecos, peluches y aparatos para niños, comparados con un precio de referencia cuando lo hay.',
    en: "LEGO, board games, dolls, plush toys and kids' gadgets, compared with a reference price when there is one.",
  },
  belleza: {
    es: 'Cuidado de la piel y el pelo, afeitado, higiene dental y perfumes, comparados con un precio de referencia cuando lo hay.',
    en: 'Skin and hair care, shaving, oral care and fragrance, compared with a reference price when there is one.',
  },
  alimentacion: {
    es: 'Comida, bebidas, café en cápsulas, suplementos y comida para mascotas, comparados con un precio de referencia cuando lo hay.',
    en: 'Food, drinks, coffee pods, supplements and pet food, compared with a reference price when there is one.',
  },
  software: {
    es: 'Licencias de sistema operativo y ofimática, antivirus, VPN y almacenamiento en la nube, comparados con un precio de referencia cuando lo hay.',
    en: 'Operating system and office licenses, antivirus, VPN and cloud storage, compared with a reference price when there is one.',
  },
  servicios: {
    es: 'Tarjetas regalo, suscripciones, membresías y cursos en línea, comparados con un precio de referencia cuando lo hay.',
    en: 'Gift cards, subscriptions, memberships and online courses, compared with a reference price when there is one.',
  },
  otros: {
    es: 'Lo que no encaja en ninguna otra categoría, comparado con un precio de referencia cuando lo hay.',
    en: 'Whatever fits no other category, compared with a reference price when there is one.',
  },
}

/** The intro line for a category page, or null for anything that is not one of our categories. */
export function categoryIntro(category: unknown, loc: 'es' | 'en' = 'es'): string | null {
  return isCategory(category) ? CATEGORY_INTRO[category][loc] : null
}

/** RSS per slice, one file per Spanish slug; the English pages link the same feed (its text is Spanish). */
export const categoryFeedPath = (slug: string) => `/feeds/categoria/${slug}.xml`
export const storeFeedPath = (slug: string) => `/feeds/tienda/${slug}.xml`
