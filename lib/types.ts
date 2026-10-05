// barato.si — the contract between the data pipeline (scripts/ + lib/) and the UI (app/).
// A scheduled job runs scripts/fetch-deals.mjs once a day, which writes static
// JSON under public/api/. The site is fully static and reads those files.

export type DealFlag =
  | 'error-probable' // discount so deep it looks like a pricing mistake
  | 'chollo' // a strong, real bargain
  | 'normal'

export interface Deal {
  /** Stable across days for the same offer (hash of canonical URL). */
  id: string
  title: string
  /** Link to the offer. Never a scraped storefront page we are not allowed to link. */
  url: string
  store: string // "Amazon", "eBay", "Steam", ...
  /** Where we learned about it ("slickdeals", "cheapshark", ...). */
  source: string
  sourceUrl: string
  currency: string // ISO 4217
  price: number
  /** Reference / list price when the source gives one or the title states it. */
  listPrice: number | null
  /** 0-100, null when no list price is known. */
  discountPct: number | null
  image: string | null
  category: string | null
  /** ISO timestamp when the source published it. */
  publishedAt: string
  /** ISO timestamp when our job first saw it. */
  foundAt: string
  /** 0-100 ranking score from lib/rank.ts. */
  score: number
  flag: DealFlag
  /** Short Spanish reasons for the flag, e.g. "92% bajo el precio de lista". */
  reasons: string[]
}

export interface DealsFile {
  /** ISO date (UTC) this file was generated for. */
  date: string
  generatedAt: string
  count: number
  /** Per-source fetch outcome, so a dead source is visible, not silent. */
  sources: { name: string; ok: boolean; count: number; error?: string }[]
  deals: Deal[] // sorted by score, descending
}

// ---- Files the job writes --------------------------------------------------
//
// public/api/deals.json              DealsFile for today (the public API)
// public/api/deals/YYYY-MM-DD.json   DealsFile archive, one per day
// public/api/index.json              { latest: string, days: string[] }
// public/feed.xml                    RSS of today's top deals
// public/llms.txt                    plain-text description of the API for agents
// public/robots.txt, public/sitemap.xml
//
// ---- Functions lib/ must export (lib/index.ts) -----------------------------
//
// scoreDeal(d: Omit<Deal,'score'|'flag'|'reasons'>, now: Date): Pick<Deal,'score'|'flag'|'reasons'>
// parsePrices(title: string): { price: number|null; listPrice: number|null; currency: string }
// dedupe(deals: Deal[]): Deal[]
