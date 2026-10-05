import { fileURLToPath } from 'node:url'
import { sources } from './sources.ts'
import { createSourceReader } from './network.ts'
import { collect, readPrevious, writeOutputs } from './pipeline.ts'

const root = fileURLToPath(new URL('../public/', import.meta.url))
const file = await collect(sources, createSourceReader(), new Date(), await readPrevious(root))
await writeOutputs(root, file)
for (const source of file.sources) console.log(`${source.name}: ${source.ok ? `${source.count} deals` : source.error}`)
console.log(`Wrote ${file.count} deals for ${file.date}`)
