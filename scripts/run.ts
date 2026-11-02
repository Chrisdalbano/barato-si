import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadLedger, saveLedger } from './ledger-store.ts'
import type { Deal } from '../lib/types.ts'
import { configuredSources } from './sources.ts'
import { createSourceReader } from './network.ts'
import { collect, readPrevious, writeOutputs } from './pipeline.ts'
import type { ClassifyCache } from '../lib/classify.ts'

export async function run(): Promise<void> {
  const root = fileURLToPath(new URL('../public/', import.meta.url))
  const started = Date.now(), now = new Date()
  const cachePath = fileURLToPath(new URL('../data/classify-cache.json', import.meta.url))
  let cache: ClassifyCache = {}
  try {
    const value = JSON.parse(await readFile(cachePath, 'utf8'))
    if (value && typeof value === 'object' && !Array.isArray(value)) cache = value
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.log('Caché de clasificación no disponible; se reconstruirá.')
  }
  const repo = fileURLToPath(new URL('../', import.meta.url))
  let ledger = await loadLedger(repo, now)
  const curated = JSON.parse(await readFile(new URL('../data/reference-prices.json', import.meta.url), 'utf8'))
  let collected: Deal[] = []
  const previous = await readPrevious(root, now, ledger)
  let latest: { generatedAt: string; sources: any[]; deals: any[] } | undefined
  try {
    const value = JSON.parse(await readFile(root + 'api/deals.json', 'utf8'))
    if (typeof value?.generatedAt === 'string' && Array.isArray(value.deals)) latest = { generatedAt: value.generatedAt, sources: value.sources || [], deals: value.deals }
  } catch { /* first run */ }
  const file = await collect(configuredSources(), createSourceReader(), now, previous, {
    runTimeout: Math.max(1, 240000 - (Date.now() - started)), env: process.env, cache, latest, ledger, curated, onLedger: value => { ledger = value }, onCollected: value => { collected = value }, onCache: value => { cache = value },
  })
  await writeOutputs(root, file)
  await saveLedger(repo, ledger)
  if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
    const privateDir = new URL('../data/private/', import.meta.url)
    await mkdir(privateDir, { recursive: true })
    await writeFile(new URL('collected.json.tmp', privateDir), JSON.stringify({ generatedAt: now.toISOString(), deals: collected }) + '\r\n')
    await rename(new URL('collected.json.tmp', privateDir), new URL('collected.json', privateDir))
  }
  await mkdir(new URL('../data/', import.meta.url), { recursive: true })
  await writeFile(cachePath + '.tmp', JSON.stringify(cache) + '\n')
  await rename(cachePath + '.tmp', cachePath)
  console.log(file.classifier ? 'Clasificador: ' + (file.classifier.ok ? 'completado' : 'falló; se aplicaron reglas') : 'Clasificador: no configurado')
  for (const source of file.sources) console.log(`${source.name}: ${source.ok ? `${source.count} ofertas; ${source.requests} consultas; ${source.ms} ms${source.reusedFrom ? `; reutilizadas de ${source.reusedFrom} [${source.error}]` : ''}` : `${source.errorEs} [${source.error}]`}`)
  console.log('Gate: ' + JSON.stringify(file.gate))
  console.log(`${file.count} ofertas guardadas para ${file.date}`)
}
