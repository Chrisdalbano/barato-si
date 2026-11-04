// Deterministic carousel slots over the published deals. Pure. Each slot states its rule in one
// line; a slot with fewer than 3 deals is dropped rather than padded. Observed evidence (our own
// price ledger) outranks a seller's list price wherever both exist.
import type { Deal, HighlightSlot, HighlightsFile, PriceLedger } from './types.ts'
import { evidenceOf, isGame } from './interest.ts'

export const SLOT_MIN = 3
export const SLOT_MAX = 12
const AI_HARDWARE = /\b(?:RTX\s*\d{4}|GeForce|Radeon(?:\s+(?:RX|AI|PRO))?|graphics card|GPU|mini ?PC|Mac Studio|Mac mini|DGX|Jetson|Ryzen\s*AI|AI Max\+?|NPU|Strix Halo|Copilot\+ PC|eGPU)\b/i
const ACCESSORY = /\b(?:case|cover|sleeve|cable|adapter|fans?|cooler|cooling|stand|mount|holder|bracket|riser|backplate|bag|backpack|skin|charger|compatible|replacement)\b/i
const comparable = (d: Deal) => ['USD', 'EUR', 'GBP'].includes(d.currency)
const pct = (v: number) => Math.round(v * 1000) / 10

/** The product's own ledger rows before today, same currency (and same Shopify configuration). */
export function priorRows(d: Deal, ledger: PriceLedger | undefined, today: string): { d: string; p: number }[] {
  const key = d.productKey, entry = key ? ledger?.products[key] : undefined
  if (!key || !entry || entry.currency !== d.currency || (key.startsWith('shopify:') && entry.title !== d.title)) return []
  return entry.series.filter(r => r.d < today && r.p > 0)
}

/** Percent the price is below the last day we observed this product. null without a prior day. */
export function dropVsLast(d: Deal, ledger: PriceLedger | undefined, today: string): number | null {
  const last = priorRows(d, ledger, today).at(-1)
  return last && d.price > 0 ? pct(1 - d.price / last.p) : null
}

interface SlotRule { id: string; titleEs: string; titleEn: string; noteEs: string; noteEn: string; pick: (deals: Deal[]) => Deal[] }

export function buildHighlights(deals: Deal[], ledger: PriceLedger | undefined, now: Date): HighlightsFile {
  const today = now.toISOString().slice(0, 10)
  const goods = deals.filter(d => !isGame(d) && d.price > 0)
  const by = (score: (d: Deal) => number) => (a: Deal, b: Deal) => score(b) - score(a) || a.id.localeCompare(b.id)
  const rules: SlotRule[] = [
    {
      id: 'caidas', titleEs: 'Caídas observadas', titleEn: 'Observed drops',
      noteEs: 'Al menos un 10 % por debajo del último precio que registramos para el mismo producto. Evidencia propia, no el precio de lista.',
      noteEn: 'At least 10% below the last price we recorded for the same product. Our own evidence, not a list price.',
      pick: ds => ds.filter(d => (dropVsLast(d, ledger, today) ?? 0) >= 10).sort(by(d => dropVsLast(d, ledger, today)!)),
    },
    {
      id: 'minimo-historico', titleEs: 'En su mínimo registrado', titleEn: 'At its recorded low',
      noteEs: 'Igual o por debajo del precio más bajo de al menos 3 días observados, en una serie que sí se movió (5 % o más entre mínimo y máximo).',
      noteEn: 'At or below the lowest price of at least 3 observed days, in a series that actually moved (5% or more between low and high).',
      pick: ds => ds.filter(d => {
        const rows = priorRows(d, ledger, today)
        if (rows.length < 3) return false
        const min = Math.min(...rows.map(r => r.p)), max = Math.max(...rows.map(r => r.p))
        return d.price <= min + 1e-9 && max >= min * 1.05
      }).sort(by(d => 1 - d.price / Math.max(...priorRows(d, ledger, today).map(r => r.p)))),
    },
    {
      id: 'hardware-ia', titleEs: 'Hardware para IA local', titleEn: 'Hardware for local AI',
      noteEs: 'GPU, mini PC, Mac Studio/mini y equipos con NPU, al menos un 10 % bajo su referencia. Ordenados por la fuerza de la evidencia: lo observado pesa más que el precio de lista.',
      noteEn: 'GPUs, mini PCs, Mac Studio/mini and NPU machines, at least 10% under their reference. Ordered by strength of evidence: observed prices weigh more than list prices.',
      pick: ds => ds.filter(d => AI_HARDWARE.test(d.title) && !ACCESSORY.test(d.title.replace(AI_HARDWARE, ' '))
        && Math.max(d.referenceDiscountPct || 0, d.discountPct || 0) >= 10).sort(by(d => evidenceOf(d))),
    },
    {
      id: 'menos-de-25', titleEs: 'Menos de 25 USD, con pruebas', titleEn: 'Under $25, with evidence',
      noteEs: 'Menos de 25 USD y al menos un 15 % bajo una referencia observada (nuestro registro, otra tienda o el historial de la fuente). El precio de lista solo no basta.',
      noteEn: 'Under $25 and at least 15% below an observed reference (our ledger, another store or the source history). A list price alone does not count.',
      pick: ds => ds.filter(d => d.currency === 'USD' && d.price < 25 && !!d.reference && d.reference.kind !== 'list' && (d.referenceDiscountPct || 0) >= 15)
        .sort(by(d => d.referenceDiscountPct || 0)),
    },
  ]
  const slots: HighlightSlot[] = []
  for (const rule of rules) {
    const picked = rule.pick(goods).slice(0, SLOT_MAX)
    if (picked.length >= SLOT_MIN) slots.push({ id: rule.id, titleEs: rule.titleEs, titleEn: rule.titleEn, noteEs: rule.noteEs, noteEn: rule.noteEn, dealIds: picked.map(d => d.id) })
  }
  // Games: one slot at most, and only deep cuts on games that cost real money.
  const games = deals.filter(d => isGame(d) && d.price > 0 && comparable(d) && (d.listPrice || 0) >= 20 && (d.discountPct || 0) >= 80)
    .sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0) || (b.listPrice || 0) - (a.listPrice || 0) || a.id.localeCompare(b.id)).slice(0, SLOT_MAX)
  if (games.length >= SLOT_MIN) slots.push({
    id: 'juegos', titleEs: 'Juegos al 80 % o más', titleEn: 'Games at 80% off or more',
    noteEs: 'Juegos con precio de lista de 20 o más y un 80 % de descuento o más. En juegos las rebajas profundas son habituales: no son errores.',
    noteEn: 'Games listed at 20 or more and 80% off or more. Deep game sales are routine: these are not errors.',
    dealIds: games.map(d => d.id),
  })
  return { version: 1, date: today, generatedAt: now.toISOString(), slots }
}
