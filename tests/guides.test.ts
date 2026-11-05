import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { GUIDE_SLUGS, guideFromEnSlug, guidePaths, isGuide } from '../lib/guides'
import type { GuideSlug } from '../lib/guides'
import { guideFor, guideList, GUIDES_UPDATED } from '../app/utils/guides'
import { basePath, localePath } from '../app/utils/locale'
import { sitemap } from '../scripts/outputs'

const slugs = Object.keys(GUIDE_SLUGS) as GuideSlug[]

describe('deal-season guides', () => {
  it('has three guides with distinct slugs in both languages', () => {
    expect(slugs).toHaveLength(3)
    expect(new Set(Object.values(GUIDE_SLUGS)).size).toBe(3)
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z0-9-]+$/)
      expect(GUIDE_SLUGS[s]).toMatch(/^[a-z0-9-]+$/)
    }
    expect(isGuide('precio-antes-inflado')).toBe(true)
    expect(isGuide('toString')).toBe(false)
    expect(isGuide('nope')).toBe(false)
    expect(guideFromEnSlug('fake-was-price')).toBe('precio-antes-inflado')
    expect(guideFromEnSlug('nope')).toBeNull()
  })

  it('round-trips paths between /guia and /en/guide', () => {
    for (const { es, en } of guidePaths()) {
      expect(localePath(es, 'en')).toBe(en)
      expect(localePath(en, 'es')).toBe(es)
      expect(basePath(`${en}/`)).toBe(es)
      expect(localePath(en, 'en')).toBe(en)
    }
  })

  it('is in the sitemap with hreflang alternates', () => {
    const map = sitemap('2026-11-05T12:00:00.000Z')
    for (const { es, en } of guidePaths()) {
      expect(map).toContain(`<loc>https://barato.si${es}/</loc>`)
      expect(map).toContain(`<loc>https://barato.si${en}/</loc>`)
      expect(map).toContain(`<xhtml:link rel="alternate" hreflang="en" href="https://barato.si${en}/"/>`)
    }
  })

  it('has full, different text per language, and no forbidden words', () => {
    for (const s of slugs) {
      const es = guideFor(s, 'es')!, en = guideFor(s, 'en')!
      for (const g of [es, en]) {
        expect(g.title.length).toBeGreaterThan(10)
        expect(g.seoTitle).toMatch(/· barato\.si$/)
        expect(g.description.length).toBeGreaterThan(80)
        expect(g.description.length).toBeLessThanOrEqual(200)
        expect(g.sections.length).toBeGreaterThan(0)
        const all = JSON.stringify(g)
        expect(all).not.toMatch(/chollo/i)
        expect(all).not.toContain('—')
        for (const src of g.sources) expect(src.url).toMatch(/^https:\/\//)
      }
      expect(es.title).not.toBe(en.title)
      expect(es.description).not.toBe(en.description)
      expect(es.sections.length).toBe(en.sections.length)
    }
    expect(guideFor('nope', 'es')).toBeNull()
    expect(GUIDES_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('lists every guide with its own path per language', () => {
    expect(guideList('es').map(g => g.path)).toEqual(guidePaths().map(p => p.es))
    expect(guideList('en').map(g => g.path)).toEqual(guidePaths().map(p => p.en))
  })

  it('is prerendered and linked from the hub', async () => {
    const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
    expect(config).toContain('guidePaths()')
    const hub = await readFile(new URL('../app/pages/black-friday.vue', import.meta.url), 'utf8')
    expect(hub).toContain('guideList(locale.value)')
    const page = await readFile(new URL('../app/pages/guia/[slug].vue', import.meta.url), 'utf8')
    expect(page).toContain("alias: ['/en/guide/:slug']")
    expect(page).not.toContain('v-html')
  })
})
