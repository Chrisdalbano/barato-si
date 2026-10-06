// barato.si — the contract between the data pipeline (scripts/ + lib/) and the UI (app/).
// A scheduled job runs scripts/fetch-deals.mjs once a day, which writes static
// JSON under public/api/. The site is fully static and reads those files.
//
// v2 (2026-10-06): parallel multi-page collection, first-party store sources,
// a separate price-error score with evidence, optional model classification,
// and an image on (nearly) every deal. Every v1 field keeps its meaning; new
// fields are optional or have a safe default so old archives still parse.

export type DealFlag =
  | 'error-probable' // discount so deep it looks like a pricing mistake (errorScore >= 70)
  | 'chollo' // a strong, real bargain (UI label: "Baratísimo")
  | 'normal'

/** Coarse Spanish category the pipeline assigns. Sources use many vocabularies; this one is ours. */
export type DealCategory =
  | 'videojuegos' | 'informatica' | 'electronica' | 'hogar' | 'cocina' | 'herramientas'
  | 'ropa' | 'deporte' | 'juguetes' | 'belleza' | 'alimentacion' | 'software' | 'otros'

export interface Deal {
  /** Stable across days for the same offer (hash of canonical URL). */
  id: string
  title: string
  /**
   * Link to the offer. For first-party sources (Steam, GOG, Epic) this IS the
   * store page. For aggregators it is the link their terms require us to use
   * (CheapShark redirect, DealNews item page). Never a scraped storefront page
   * we are not allowed to link.
   */
  url: string
  /**
   * The merchant's own page when we know it and may link it (Steam app page
   * for a CheapShark deal with a steamAppID, Techbargains items whose feed
   * link already points at the retailer, ...). null when `url` is the best we have.
   * The UI prefers this for the "Ver en <tienda>" action and falls back to `url`.
   */
  storeUrl: string | null
  store: string // "Amazon", "Steam", "GOG", "Best Buy", ...
  /** Hostname of the merchant (e.g. "amazon.com", "store.steampowered.com"), for favicons/grouping. */
  storeDomain: string | null
  /** Where we learned about it ("Steam", "GOG", "CheapShark", "DealNews", "Techbargains", ...). */
  source: string
  /** Human-readable source item page, or source homepage when unavailable. */
  sourceUrl: string
  currency: string // ISO 4217
  price: number
  /** Reference / list price when the source gives one or the title states it. */
  listPrice: number | null
  /** 0-100, null when no list price is known. */
  discountPct: number | null
  /** Product image from the source (https). null only when the source has none. */
  image: string | null
  /** Our coarse category (DealCategory) when classified; else the source's label or null. */
  category: DealCategory | string | null
  /** ISO timestamp when the source published it. */
  publishedAt: string
  /** ISO timestamp when our job first saw it. */
  foundAt: string
  /** 0-100 ranking score from lib/rank.ts (how good a deal it is). */
  score: number
  /**
   * 0-100 likelihood that this is a PRICING MISTAKE rather than an intended sale.
   * Independent from `score`: a free game scores high and has errorScore ~0.
   * flag === 'error-probable' iff errorScore >= 70. Default 0 in v1 data.
   */
  errorScore: number
  /**
   * Short Spanish evidence lines behind errorScore, strongest first, e.g.
   * "Portátil con RTX a 9 % del precio de lista", "La fuente dice «price error»",
   * "Mismo precio visto 4 días seguidos (rebaja estable, no error)".
   * Empty when errorScore is 0.
   */
  errorSignals: string[]
  flag: DealFlag
  /** Short Spanish reasons for the flag, e.g. "92 % bajo el precio de lista". */
  reasons: string[]
  /** Plain source description used as explicit pricing-error evidence. */
  sourceText?: string
  /** Optional source evidence (votes, deal rating); never inferred from product review counts. */
  sourceSignal?: number
  /**
   * What we have seen for this id in the retained archive (previous days).
   * Absent when first seen today. A price that has held for days is a sale, not a mistake.
   */
  history?: { days: number; minPrice: number; maxPrice: number; firstSeen: string }
  /**
   * Optional classification by a small language model (lib/classify.ts), run only
   * on error candidates and ambiguous items, cached by id. Absent when no model
   * key is configured or the call failed; the deterministic rules still apply.
   */
  ai?: {
    /** Canonical product name ("Lenovo Legion 5 15.6\" RTX 4060 laptop"), for display and cross-source dedupe. */
    product: string
    category: DealCategory
    /** error = looks like a pricing mistake; deep = real but unusual sale; normal; noise = not a single product offer (roundup, service, coupon). */
    verdict: 'error' | 'deep' | 'normal' | 'noise'
    /** 0-1 */
    confidence: number
    /** One Spanish sentence a reader can act on. Never contains a URL. */
    note: string
    model: string
  }
  /** Original syndicated item attribution, retained for sources whose terms require it (DealNews). */
  syndication?: { attribution: string; feedUrl: string; itemUrl?: string; itemXml?: string; descriptionHtml?: string }
}

export interface SourceOutcome {
  name: string
  ok: boolean
  /** Normalized offers before cross-source dedupe. */
  count: number
  /** How many endpoint requests (pages/feeds) this source made this run. */
  requests?: number
  /** Wall time in ms for this source (sources run in parallel). */
  ms?: number
  /** First-party store API/feed (true) or an aggregator/deal publisher (false). */
  direct?: boolean
  /**
   * Set when the source failed this run and its offers were carried over from a
   * previous run less than 14 hours old (generatedAt of that run). Happens when a
   * publisher's bot protection blocks the CI runner but not the owner's machine.
   * `ok` is true and `count` is the carried count; `errorEs` says so in Spanish.
   */
  reusedFrom?: string
  error?: string
  errorEs?: string
}

export interface DealsFile {
  /** ISO date (UTC) this file was generated for. */
  date: string
  generatedAt: string
  count: number
  /** Per-source fetch outcome, so a dead source is visible, not silent. */
  sources: SourceOutcome[]
  /**
   * Ordered: a balanced top 30 (non-game / game alternating), then descending score.
   * Up to 400 deals. The UI does its own sorting/filtering; the order here is the editorial default.
   */
  deals: Deal[]
  /**
   * Model classification outcome for this run, when configured. Visible so a
   * silent model failure is never mistaken for "no candidates".
   */
  classifier?: { model: string; ok: boolean; classified: number; cached: number; error?: string }
  /** Schema version of this file. Absent in v1 files. */
  version?: 2
}

// ---- Files the job writes --------------------------------------------------
//
// public/api/deals.json              DealsFile for today (the public API), up to 400 deals
// public/api/errors.json             { date, generatedAt, deals: Deal[] } — every deal with errorScore >= 40,
//                                    sorted by errorScore desc. The "cazador de errores" view reads this.
// public/api/deals/YYYY-MM-DD.json   DealsFile archive, one per day (30 days)
// public/api/index.json              { latest: string, days: string[] }
// public/feed.xml                    RSS of today's top deals
// public/errors.xml                  RSS of today's probable price errors
// public/llms.txt                    plain-text description of the API for agents
// public/robots.txt, public/sitemap.xml
// data/classify-cache.json           model verdicts by deal id (committed, small, pruned to 30 days)
//
// ---- Functions lib/ must export (lib/index.ts) -----------------------------
//
// scoreDeal(d: Omit<Deal,'score'|'flag'|'reasons'|'errorScore'|'errorSignals'>, now: Date, history?: Deal['history']): Pick<Deal,'score'|'flag'|'reasons'|'errorScore'|'errorSignals'>
// parsePrices(title: string): { price: number|null; listPrice: number|null; currency: string }
// dedupe(deals: Deal[]): Deal[]
// categorize(title: string, sourceCategory: string|null, store: string): DealCategory
