import { run } from './run.ts'

try { await run() } catch {
  console.error('No se pudo completar la actualización de ofertas.')
  process.exitCode = 1
}
