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
