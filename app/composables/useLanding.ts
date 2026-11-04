import type { ComputedRef, InjectionKey } from 'vue'
import type { DealView } from './useDeals'
import { CATEGORY_SLUG_EN, categoryPaths, dealAnchor, isCategory, landingPages, storePaths, storeSlug } from '../../lib/landing'
import type { LandingSet } from '../../lib/landing'
import { SITE } from '../utils/api'

// Category and store pages exist only for slices with deals today (lib/landing.ts,
// the same rule the sitemap and the prerender list use). Pages that show today's
// data provide the set; rows deep in the tree ask it for links. Without a
// provider (the archive, an old day) there are no links and no share control, so
// a row never points at a page that was not built.

interface Landing {
  set: ComputedRef<LandingSet>
  cats: ComputedRef<Set<string>>
  stores: ComputedRef<Set<string>>
}
const LANDING_KEY: InjectionKey<Landing> = Symbol('landing')

export function provideLanding(deals: () => readonly DealView[] | null | undefined) {
  const set = computed(() => landingPages(deals() ?? []))
  provide(LANDING_KEY, {
    set,
    cats: computed(() => new Set(set.value.categories.map(c => c.slug))),
    stores: computed(() => new Set(set.value.stores.map(s => s.slug))),
  })
  return set
}

/** Trailing slash: what the static host serves without a redirect. */
export function categoryPath(category: string, loc: 'es' | 'en'): string | null {
  return isCategory(category) ? `${categoryPaths({ slug: category, enSlug: CATEGORY_SLUG_EN[category] })[loc]}/` : null
}
export function storePath(store: string, loc: 'es' | 'en'): string | null {
  const slug = storeSlug(store)
  return slug ? `${storePaths({ slug })[loc]}/` : null
}

export function useLandingLinks() {
  const landing = inject(LANDING_KEY, null)
  const { locale } = useLang()
  /** Localized path of the deal's category page, or null when there is none today. */
  function categoryHref(d: Pick<DealView, 'category'>): string | null {
    const c = d.category
    if (!landing || !c || !landing.cats.value.has(c)) return null
    return categoryPath(c, locale.value)
  }
  /** Localized path of the deal's store page, or null when there is none today. */
  function storeHref(d: Pick<DealView, 'store'>): string | null {
    if (!landing || !landing.stores.value.has(storeSlug(d.store ?? ''))) return null
    return storePath(d.store, locale.value)
  }
  return { categoryHref, storeHref, live: !!landing }
}

/**
 * Where a shared deal sends people: a barato.si page with the deal's row on it,
 * never the merchant, so the visit comes back here. Rows on /errores share
 * /errores; anything else goes to its category page (which lists every deal in
 * the category, games included), else its store page, else the home page.
 */
export function shareTarget(d: Pick<DealView, 'id' | 'category' | 'store'>, loc: 'es' | 'en', on: 'errors' | 'list'): string {
  const tail = `?ref=share#${dealAnchor(d.id)}`
  if (on === 'errors') return `${SITE}${loc === 'en' ? '/en/errores/' : '/errores/'}${tail}`
  const page = (d.category ? categoryPath(d.category, loc) : null) ?? storePath(d.store ?? '', loc)
  return page ? `${SITE}${page}${tail}` : `${SITE}${loc === 'en' ? '/en/' : '/'}`
}
