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
  | 'ropa' | 'deporte' | 'juguetes' | 'belleza' | 'alimentacion' | 'software' | 'servicios' | 'otros'

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
  /** v3: a second picture to try if `image` fails or is Amazon's 1x1 placeholder. */
  imageFallback?: string | null
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

  // ---- v3 (2026-11-02, docs/V3-DESIGN.md). All optional: v1/v2 archives still parse. ----

  /** Stable product identity across sources: asin:B0..., bestbuy:123, shopify:domain:handle, steam:440, url:<id>. */
  productKey?: string
  /** Canonical brand when recognized ("ASUS", "NVIDIA"); null when unknown. Unknown is not an insult, it just earns no brand points. */
  brand?: string | null
  /** The best evidence of what this product normally costs. Absent when we have none. */
  reference?: {
    price: number
    /** Strongest first: ledger > cross-store > curated > source-previous > list. */
    kind: ReferenceKind
    /** Observed days behind a ledger reference; stores compared for cross-store. */
    observations?: number
    /** ISO date this evidence is from (curated entries are dated). */
    asOf?: string
    /** Short Spanish line for readers: "Mediana de 14 días observados". */
    note: string
  }
  /** 0-100 discount against `reference`, null without one. This, not discountPct, is what error scoring trusts. */
  referenceDiscountPct?: number | null
  /** 0-100: is this worth a reader's attention? Replaces community votes. */
  interest?: number
  /** Short Spanish evidence behind `interest`, strongest first. */
  interestSignals?: string[]
  /** True only when the primary link goes straight to the merchant's product page. */
  direct?: boolean
  /** Every source that carried this product this run. Two or more is corroboration. */
  seenIn?: string[]
  /** DealNews staff pick flag. */
  staffPick?: boolean
}

export type ReferenceKind = 'ledger' | 'cross-store' | 'curated' | 'source-previous' | 'list'

/** data/price-ledger.json. Every collected non-game offer, published or not. */
export interface PriceLedger {
  version: 1
  updatedAt: string
  /** productKey -> series. `d` is a UTC day, `p` that day's lowest price, `s` the source. */
  products: Record<string, { title: string; currency: string; firstSeen: string; series: { d: string; p: number; s: string }[] }>
}

/** What the interest gate kept out this run, so the filter is visible and never silent. */
export interface GateReport {
  considered: number
  published: number
  rejected: number
  byReason: Record<string, number>
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
   * Editorial order (scripts/pipeline.ts balanceRanking): price-error candidates
   * (errorScore >= 40) first, strongest first; then score order with one game for
   * every seven non-game offers. Up to 400 deals. The UI does its own sorting/filtering.
   */
  deals: Deal[]
  /**
   * Model classification outcome for this run, when configured. Visible so a
   * silent model failure is never mistaken for "no candidates".
   */
  classifier?: { model: string; ok: boolean; classified: number; cached: number; error?: string }
  /** Schema version of this file. Absent in v1 files. */
  version?: 2 | 3
  /** v3: what the interest gate rejected and why. */
  gate?: GateReport
}

// ---- v3.1 (2026-11-04): errors context, highlights, the .si oracle. -------
// Added with a dated NOTES.md entry. All new files; DealsFile is unchanged.

/** public/api/errors.json. `deals` keeps its meaning; the two lists after it are context, never errors. */
export interface ErrorsFile {
  date: string
  generatedAt: string
  /** Every collected deal with errorScore >= 40 today, strongest first. Empty is a result. */
  deals: Deal[]
  /** Past candidates (errorScore >= 40) from the published day archives, last 30 days, newest first, one per product. */
  recent?: { date: string; deal: Deal }[]
  /** Today's 5 highest errorScore deals BELOW 40 (games excluded). Closest, not errors. */
  nearest?: Deal[]
}

export interface HighlightSlot {
  /** Stable slug: 'caidas' | 'minimo-historico' | 'hardware-ia' | 'menos-de-25' | 'juegos'. */
  id: string
  titleEs: string; titleEn: string
  /** One dry line stating the rule that qualifies these deals. */
  noteEs: string; noteEn: string
  /** Ids present in public/api/deals.json of the same run, strongest first, 3..12. */
  dealIds: string[]
}
/** public/api/highlights.json. A slot with fewer than 3 deals is omitted, so `slots` may be empty. */
export interface HighlightsFile { version: 1; date: string; generatedAt: string; slots: HighlightSlot[] }

export interface OraclePrediction {
  dealId: string; productKey: string; title: string
  price: number; currency: string
  /** P(an observed price within horizonDays is >= dropThresholdPct below `price`), posterior mean, 0..1. */
  pDrop: number
  horizonDays: number
  verdict: 'espera' | 'compra' | 'aprendiendo'
  /** observations = the product's own completed, non-overlapping windows. category is null when the global prior was used. */
  basis: { observations: number; priorAlpha: number; priorBeta: number; category: string | null }
}
export interface OracleScorecard {
  resolved: number
  /** Model Brier score over resolved predictions; null until one resolves. */
  brier: number | null
  /** Brier of the naive base-rate predictor (the pooled rate known when each prediction was made), same set. */
  baselineBrier: number | null
  /** Calibration: 5 buckets of predicted pDrop, [0,.2) ... [.8,1]; hitRate null when n is 0. */
  buckets: { lo: number; hi: number; n: number; hitRate: number | null }[]
  /** Date of the oldest resolved prediction. */
  since: string | null
  /** v4.2: first UTC day an open prediction can resolve (its date + horizon + 1). null when none is open. Absent in older files. */
  firstDue?: string | null
}
/** public/api/oracle.json: "¿compra ahora o espera?", self-scored. */
export interface OracleFile {
  version: 1; date: string; generatedAt: string
  model: string
  horizonDays: number; dropThresholdPct: number
  predictions: OraclePrediction[]
  scorecard: OracleScorecard
}

// ---- v4.2 (2026-11-04): the weekly digest. A new file; nothing above changes. ----

/** A deal as the digest shows it: enough to name, picture and link it. */
export interface WeekDeal {
  id: string; title: string; store: string
  url: string; storeUrl: string | null; image: string | null
  currency: string; category: string | null
}
/**
 * public/api/week.json, "La semana de Don Centavo": rebuilt every run from the last 7 UTC days of
 * published archives (today included), the price ledger and the oracle. Every list may be empty.
 */
export interface WeekFile {
  version: 1
  generatedAt: string
  /** First and last UTC day of the window, inclusive (to = today). */
  from: string; to: string
  /** ISO week of `to` ("2026-W45"): the RSS guid, so a feed reader gets one item per week. */
  isoWeek: string
  /** Published day archives inside the window; 7 is a full week. */
  days: number
  /** Distinct products (productKey + currency) published in the window. */
  products: number
  /** Largest fall per product inside the window against the previous day we observed it, >= 10 %. */
  drops: { deal: WeekDeal; before: number; beforeDate: string; after: number; afterDate: string; pct: number }[]
  /** Published at or below the lowest of >= 3 prior observed days, in a series that moved >= 5 %. */
  lows: { deal: WeekDeal; price: number; date: string; priorDays: number; priorLow: number; priorHigh: number }[]
  /** Candidates (errorScore >= 40) from the window's archives, re-scored by today's rules. `note`: the classifier's cached line, when one exists. */
  errors: { deal: WeekDeal; date: string; price: number; errorScore: number; signals: string[]; note: string | null }[]
  forecast: {
    /** Today's predictions by verdict. */
    predictions: number; espera: number; compra: number; aprendiendo: number
    /** Log entries made inside the window, and those resolved inside it (with how many saw the drop). */
    logged: number; resolved: number; dropped: number
    /** First day an open prediction can resolve. */
    firstDue: string | null
    /** The oracle's cumulative scorecard once at least one prediction has resolved; null before. */
    scorecard: OracleScorecard | null
  }
  /** Don Centavo's rule of the week (1-based n, rotates with the ISO week). */
  rule: { n: number; es: string; en: string }
}

// ---- Files the job writes --------------------------------------------------
//
// public/api/deals.json              DealsFile for today (the public API), up to 400 deals
// public/api/errors.json             ErrorsFile { date, generatedAt, deals, recent?, nearest? } — every deal with errorScore >= 40,
//                                    sorted by errorScore desc. The "cazador de errores" view reads this.
// public/api/deals/YYYY-MM-DD.json   DealsFile archive, one per day (30 days)
// public/api/index.json              { latest: string, days: string[] }
// public/feed.xml                    RSS of today's top deals
// public/errors.xml                  RSS of today's probable price errors
// public/llms.txt                    plain-text description of the API for agents
// public/api/highlights.json         HighlightsFile: deterministic carousel slots over deals.json ids
// public/api/oracle.json             OracleFile: buy-now-or-wait predictions plus their own scorecard
// public/api/week.json               WeekFile: the weekly digest (also /semana.xml)
// public/feeds/categoria/<slug>.xml  RSS per category, public/feeds/tienda/<slug>.xml per store (not committed; rebuilt every run)
// public/robots.txt, public/sitemap.xml
// data/classify-cache.json           model verdicts by deal id (committed, small, pruned to 30 days)
// data/oracle-log.json               every oracle prediction and its outcome once resolved (bounded)
//
// ---- Functions lib/ must export (lib/index.ts) -----------------------------
//
// scoreDeal(d: Omit<Deal,'score'|'flag'|'reasons'|'errorScore'|'errorSignals'>, now: Date, history?: Deal['history']): Pick<Deal,'score'|'flag'|'reasons'|'errorScore'|'errorSignals'>
// parsePrices(title: string): { price: number|null; listPrice: number|null; currency: string }
// dedupe(deals: Deal[]): Deal[]
// categorize(title: string, sourceCategory: string|null, store: string): DealCategory
