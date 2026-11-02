import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { PriceLedger } from '../lib/types.ts'
import { pruneLedger, seedLedger } from '../lib/ledger.ts'
export async function loadLedger(repo: string, now: Date): Promise<PriceLedger> {
  try {
    const ledger = JSON.parse(await readFile(join(repo, 'data/price-ledger.json'), 'utf8'))
    if (ledger.version !== 1 || !ledger.products) throw new Error('Invalid price ledger')
    return pruneLedger(ledger, now)
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  const archives = []
  const dir = join(repo, 'public/api/deals')
  let names: string[] = []
  try { names = await readdir(dir) } catch(e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  for (const name of names) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
    const file = JSON.parse(await readFile(join(dir,name), 'utf8'))
    if (Array.isArray(file.deals)) archives.push({ date: name.slice(0,10), deals: file.deals })
  }
  return seedLedger(archives, now)
}
export async function saveLedger(repo: string, ledger: PriceLedger): Promise<void> {
  const path = join(repo,'data/price-ledger.json')
  await mkdir(join(repo,'data'), { recursive: true })
  const json = JSON.stringify(ledger) + '\r\n'
  if (Buffer.byteLength(json) > 3_000_000) throw new Error('Price ledger exceeds 3 MB')
  await writeFile(path + '.tmp', json)
  await rename(path + '.tmp', path)
}
