// The Black Friday / Cyber Monday page (/black-friday, /en/black-friday). Pure:
// it only orders and groups what today's published files already hold. No
// special list, no threshold lowered for the season, no countdown. Empty groups
// stay empty and the page says so.
import { landingPages } from '../../lib/landing'
import type { CategoryPage } from '../../lib/landing'
import type { Deal } from '../../lib/types'
import { byEvidence, depthOf, ERROR_LEVELS, strengthOf } from './deal'
import type { EvidenceStrength } from './deal'

/** A deep cut is at least this far under its reference (the declared discount when there is no separate figure). */
export const HUB_MIN_DEPTH = 30
/** Rows per group on the page. /errores and the category pages have the rest. */
export const HUB_MAX_ERRORS = 12
export const HUB_MAX_DEEP = 24

export interface HubDeal {
  id: string
  category?: string | null
  store: string
  errorScore: number
  reference?: Deal['reference']
  referenceDiscountPct?: number | null
  discountPct?: number | null
}

export interface HubSections<T> {
  /** Price-error candidates (errorScore >= 40), strongest evidence first, capped. */
  errors: T[]
  /** How many candidates there were before the cap. */
  errorsTotal: number
  /** Non-game offers at least HUB_MIN_DEPTH % under a reference and not in `errors`: strongest evidence first, then deepest, capped. */
  deep: T[]
  deepTotal: number
  /** Category pages that exist today (at least one deal), largest first. */
  categories: CategoryPage[]
  /** Nothing in either list. */
  empty: boolean
}

const RANK: Record<EvidenceStrength, number> = { fuerte: 3, media: 2, debil: 1, ninguna: 0 }

/**
 * The hub's groups, from today's deals and the errors file's candidates.
 * `errors` may hold candidates outside today's published list (errors.json is
 * not capped at 250); both inputs are merged by id, so nothing is listed twice.
 * Games are left out of the deep cuts (their discounts are routinely 80 %+ and
 * would fill the list); they keep their category page. Never mutates its inputs.
 */
export function hubSections<T extends HubDeal>(deals: readonly T[], errors: readonly T[] = []): HubSections<T> {
  const bar = ERROR_LEVELS[0]
  const seen = new Set<string>()
  const candidates: T[] = []
  for (const d of [...errors, ...deals]) {
    if (d.errorScore >= bar && !seen.has(d.id)) { seen.add(d.id); candidates.push(d) }
  }
  const ranked = byEvidence(candidates)

  const deepAll = deals
    .map((d, i) => ({ d, i, depth: depthOf(d) }))
    .filter((x): x is { d: T; i: number; depth: number } =>
      !seen.has(x.d.id) && x.d.category !== 'videojuegos' && strengthOf(x.d) !== 'ninguna'
      && typeof x.depth === 'number' && Number.isFinite(x.depth) && x.depth >= HUB_MIN_DEPTH)
    .sort((a, b) => RANK[strengthOf(b.d)] - RANK[strengthOf(a.d)] || b.depth - a.depth || a.i - b.i)
    .map(x => x.d)

  const errorsShown = ranked.slice(0, HUB_MAX_ERRORS)
  const deep = deepAll.slice(0, HUB_MAX_DEEP)
  return {
    errors: errorsShown,
    errorsTotal: ranked.length,
    deep,
    deepTotal: deepAll.length,
    categories: landingPages(deals).categories,
    empty: !errorsShown.length && !deep.length,
  }
}
