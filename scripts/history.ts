import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Deal } from '../lib/types.ts'

export async function readPrevious(root: string, now = new Date()): Promise<Deal[]> {
  const today = now.toISOString().slice(0, 10)
  const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const known = new Map<string, Deal>()
  const prices = new Map<string, Map<string, number>>()
  async function remember(path: string, dayHint?: string) {
    try {
      const file = JSON.parse(await readFile(path, 'utf8'))
      const day = dayHint || file.date
      for (const raw of file.deals || []) {
        if (typeof raw.id !== 'string' || !Number.isFinite(raw.price) || raw.price < 0) continue
        const d: Deal = { ...raw, errorScore: raw.errorScore ?? 0, errorSignals: raw.errorSignals ?? [], storeUrl: raw.storeUrl ?? null, storeDomain: raw.storeDomain ?? null }
        delete d.history
        if (!known.has(d.id) || d.foundAt < known.get(d.id)!.foundAt) known.set(d.id, d)
        if (day && day >= cutoff && day < today) {
          if (!prices.has(d.id)) prices.set(d.id, new Map())
          prices.get(d.id)!.set(day, d.price)
        }
      }
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('No se pudo leer el archivo de ofertas anterior.') }
  }
  await remember(join(root, 'api/deals.json'))
  let names: string[] = []
  try { names = await readdir(join(root, 'api/deals')) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  for (const name of names.sort()) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) >= cutoff && name.slice(0, 10) < today) await remember(join(root, 'api/deals', name), name.slice(0, 10))
  for (const [id, d] of known) {
    const days = prices.get(id)
    if (days?.size) d.history = { days: days.size, minPrice: Math.min(...days.values()), maxPrice: Math.max(...days.values()), firstSeen: d.foundAt }
  }
  return [...known.values()]
}
