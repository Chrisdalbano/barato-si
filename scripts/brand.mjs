// Renders the brand PNGs from the HTML compositions in brand/ with headless Chrome.
// No dependencies: Chrome's own --screenshot. Run by hand when the logo changes:
//   node scripts/brand.mjs            (CHROME=<path to chrome> to override)
// Writes public/og.png, public/og-en.png, public/apple-touch-icon.png,
// public/icon-512.png and public/icon-maskable-512.png. public/favicon.svg is
// hand-written (it carries its own dark-scheme rule) and is not touched here.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const chrome = candidates.find(p => existsSync(p))
if (!chrome) { console.error('Chrome not found; set CHROME.'); process.exit(1) }

// file, page query, viewport
const jobs = [
  ['og.png', 'og.html?lang=es', 1200, 630],
  ['og-en.png', 'og.html?lang=en', 1200, 630],
  // The mark spans 66% of the tile: room for iOS's rounded corners.
  ['apple-touch-icon.png', 'icon.html?size=180&mark=0.66', 180, 180],
  ['icon-512.png', 'icon.html?size=512&mark=0.66', 512, 512],
  // Maskable: the mark's farthest corner stays inside the 40% safe circle.
  ['icon-maskable-512.png', 'icon.html?size=512&mark=0.52', 512, 512],
]

for (const [out, page, w, h] of jobs) {
  const url = pathToFileURL(join(root, 'brand', page.split('?')[0])).href + '?' + page.split('?')[1]
  const target = join(root, 'public', out)
  const r = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', '--virtual-time-budget=2000',
    `--window-size=${w},${h}`, `--screenshot=${target}`, url,
  ], { encoding: 'utf8' })
  if (r.status !== 0) { console.error(out, r.stderr); process.exit(1) }
  console.log('wrote', `public/${out}`, `${w}x${h}`)
}
