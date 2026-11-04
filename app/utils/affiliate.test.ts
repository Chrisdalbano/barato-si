import { describe, expect, it } from 'vitest'
import { affiliateLink, relFor } from './affiliate'
import { basePath, localeOfPath, localePath } from './locale'

describe('affiliateLink', () => {
  it('tags only a canonical amazon.com/dp link', () => {
    expect(affiliateLink('https://www.amazon.com/dp/B0GL5686YJ', 'barato-20')).toEqual({ href: 'https://www.amazon.com/dp/B0GL5686YJ?tag=barato-20', sponsored: true })
    expect(affiliateLink('https://amazon.com/dp/B0GL5686YJ/', 'barato-20').sponsored).toBe(true)
  })
  it('leaves everything else alone', () => {
    const t = 'barato-20'
    expect(affiliateLink('https://www.amazon.com/dp/B0GL5686YJ?tag=other-20', t)).toEqual({ href: 'https://www.amazon.com/dp/B0GL5686YJ?tag=other-20', sponsored: false })
    expect(affiliateLink('https://www.amazon.com/dp/B0GL5686YJ?ascsubtag=x', t).sponsored).toBe(false)
    expect(affiliateLink('https://www.amazon.com/gp/product/B0HJB6SFRD/ref=ox?smid=1', t).sponsored).toBe(false)
    expect(affiliateLink('https://www.amazon.co.uk/dp/B0GL5686YJ', t).sponsored).toBe(false)
    expect(affiliateLink('http://www.amazon.com/dp/B0GL5686YJ', t).sponsored).toBe(false)
    expect(affiliateLink('https://evil.com/?u=amazon.com/dp/B0GL5686YJ', t).sponsored).toBe(false)
    expect(affiliateLink('not a url', t).href).toBe('not a url')
  })
  it('does nothing without a valid tag', () => {
    expect(affiliateLink('https://www.amazon.com/dp/B0GL5686YJ', '').sponsored).toBe(false)
    expect(affiliateLink('https://www.amazon.com/dp/B0GL5686YJ', undefined).sponsored).toBe(false)
    expect(affiliateLink('https://www.amazon.com/dp/B0GL5686YJ', 'a b&c=d').sponsored).toBe(false)
  })
  it('rel marks paid links', () => {
    expect(relFor({ href: '', sponsored: true })).toBe('sponsored nofollow noopener')
    expect(relFor({ href: '', sponsored: false })).toBe('noopener')
  })
})

describe('locale paths', () => {
  it('maps both ways', () => {
    expect(localeOfPath('/en')).toBe('en')
    expect(localeOfPath('/en/errores')).toBe('en')
    expect(localeOfPath('/enlaces')).toBe('es')
    expect(localePath('/', 'en')).toBe('/en')
    expect(localePath('/errores/', 'en')).toBe('/en/errores')
    expect(localePath('/privacidad', 'en')).toBe('/en/privacy')
    expect(localePath('/en/privacy', 'es')).toBe('/privacidad')
    expect(localePath('/en', 'es')).toBe('/')
    expect(basePath('/en/si')).toBe('/si')
  })
})
