import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
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
  const previous = await readPrevious(root, now)
  let latest: { generatedAt: string; sources: any[]; deals: any[] } | undefined
  try {
    const value = JSON.parse(await readFile(root + 'api/deals.json', 'utf8'))
    if (typeof value?.generatedAt === 'string' && Array.isArray(value.deals)) latest = { generatedAt: value.generatedAt, sources: value.sources || [], deals: value.deals }
  } catch { /* first run */ }
  const file = await collect(configuredSources(), createSourceReader(), now, previous, {
    runTimeout: Math.max(1, 240000 - (Date.now() - started)), env: process.env, cache, latest, onCache: value => { cache = value },
  })
  await writeOutputs(root, file)
  await mkdir(new URL('../data/', import.meta.url), { recursive: true })
  await writeFile(cachePath + '.tmp', JSON.stringify(cache) + '\n')
  await rename(cachePath + '.tmp', cachePath)
  console.log(file.classifier ? 'Clasificador: ' + (file.classifier.ok ? 'completado' : 'falló; se aplicaron reglas') : 'Clasificador: no configurado')
  for (const source of file.sources) console.log(`${source.name}: ${source.ok ? `${source.count} ofertas; ${source.requests} consultas; ${source.ms} ms${source.reusedFrom ? `; reutilizadas de ${source.reusedFrom} [${source.error}]` : ''}` : `${source.errorEs} [${source.error}]`}`)
  console.log(`${file.count} ofertas guardadas para ${file.date}`)
}
