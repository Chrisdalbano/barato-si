import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { emptyOracleLog, type OracleLog } from '../lib/oracle.ts'

/** data/oracle-log.json: every oracle prediction and, once its horizon passes, its outcome. */
export async function loadOracleLog(repo: string): Promise<OracleLog> {
  try {
    const log = JSON.parse(await readFile(join(repo, 'data/oracle-log.json'), 'utf8'))
    if (log?.version !== 1 || !Array.isArray(log.entries)) throw new Error('Invalid oracle log')
    return { version: 1, entries: log.entries.filter((e: any) => e && typeof e.date === 'string' && typeof e.productKey === 'string' && Number.isFinite(e.price) && Number.isFinite(e.pDrop)) }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyOracleLog()
    throw e
  }
}
export async function saveOracleLog(repo: string, log: OracleLog): Promise<void> {
  const path = join(repo, 'data/oracle-log.json')
  await mkdir(join(repo, 'data'), { recursive: true })
  const json = JSON.stringify(log) + '\r\n'
  if (Buffer.byteLength(json) > 5_000_000) throw new Error('Oracle log exceeds 5 MB')
  await writeFile(path + '.tmp', json)
  await rename(path + '.tmp', path)
}
