// barato.si — keep package-lock.json installable on Linux CI.
//
// npm writes only the current platform's native bindings into a lockfile it
// creates with node_modules present (npm/cli#4828). This repo's lockfile is
// made on Windows, so `npm ci` on the Ubuntu runner used to miss
// @rollup/rollup-linux-x64-gnu and friends. Until 2026-10-14 the workflow
// worked around that by deleting the lockfile and resolving fresh in CI, which
// broke the moment a bad upstream release (@vitejs/devtools 0.8.0) made npm's
// resolver crash. Fresh resolution in CI is gone; this script adds the missing
// Linux x64 (glibc) entries next to the Windows ones so `npm ci` works on both.
//
//   node scripts/lockfile-platforms.mjs          add missing entries, rewrite the lockfile
//   node scripts/lockfile-platforms.mjs --check  exit 1 and list what is missing
//
// Run it after any `npm install` that changes the lockfile. Idempotent.
import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../package-lock.json', import.meta.url)
const lock = JSON.parse(readFileSync(path, 'utf8'))
const packages = lock.packages ?? {}
const check = process.argv.includes('--check')

// Platforms CI and the owner use. Names come from each parent's own
// optionalDependencies map, so nothing is invented: a package is added only
// when its parent already declares it for that platform at an exact version.
const targets = [
  { os: 'linux', cpu: 'x64', match: (name) => /linux-x64(?:-gnu)?$/.test(name) && !/musl/.test(name) },
]

// npm resolution order: the parent's own node_modules, each enclosing one, then the root.
function locate(parent, name) {
  const dirs = []
  for (let d = parent; ; d = d.replace(/\/?node_modules\/(?:@[^/]+\/)?[^/]+$/, '')) {
    dirs.push(d)
    if (!d) break
  }
  return dirs.map((d) => `${d ? d + '/' : ''}node_modules/${name}`).find((k) => packages[k])
}
const exact = (spec) => (/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(spec) ? spec : null)

const missing = []
for (const [parent, entry] of Object.entries(packages)) {
  const optional = entry?.optionalDependencies
  if (!optional) continue
  // Where npm put this parent's present bindings (hoisted to the root, usually).
  // A present sibling, whatever its platform, also lends license/engines/funding.
  const found = Object.keys(optional).map((name) => locate(parent, name)).find(Boolean)
  const dir = found ? found.slice(0, found.lastIndexOf('node_modules/')).replace(/\/$/, '') : ''
  const sibling = found ? packages[found] : undefined
  for (const target of targets) {
    for (const [name, spec] of Object.entries(optional)) {
      if (!target.match(name) || locate(parent, name)) continue
      const version = exact(spec)
      if (!version) continue
      const key = `${dir ? dir + '/' : ''}node_modules/${name}`
      missing.push(key)
      if (check) continue
      const { license, engines, funding } = sibling ?? {}
      packages[key] = {
        version,
        cpu: [target.cpu],
        ...(license ? { license } : {}),
        optional: true,
        os: [target.os],
        ...(engines ? { engines } : {}),
        ...(funding ? { funding } : {}),
      }
    }
  }
}

if (check) {
  if (missing.length) {
    console.error(`package-lock.json lacks ${missing.length} native binding(s) for CI:\n  ${missing.join('\n  ')}\nRun: npm run lock:platforms`)
    process.exit(1)
  }
  console.log('package-lock.json covers linux-x64.')
} else if (missing.length) {
  // Keep npm's ordering: the root entry first, then packages sorted by path.
  lock.packages = Object.fromEntries(Object.entries(packages).sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'en'))))
  writeFileSync(path, JSON.stringify(lock, null, 2) + '\n')
  console.log(`Added ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'}:\n  ${missing.join('\n  ')}`)
} else {
  console.log('package-lock.json already covers linux-x64.')
}
