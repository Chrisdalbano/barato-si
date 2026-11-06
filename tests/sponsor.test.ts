import { describe, expect, it } from 'vitest'
import { activeSponsor, bookedSponsor } from '../app/utils/sponsor'
import file from '../app/data/sponsor.json'

const on = { active: true, label: 'Acme', text: 'Teclados mecánicos con 20 % de descuento', url: 'https://acme.example/teclados', until: '2026-11-11' }

describe('sponsored slot', () => {
  it('shows an active sponsor through its last day', () => {
    const { active: _a, ...shown } = on
    expect(activeSponsor(on, '2026-11-04')).toEqual({ ...shown, image: null })
    expect(activeSponsor(on, '2026-11-11')?.label).toBe('Acme')
    expect(activeSponsor(on, '2026-11-12')).toBeNull()
  })
  it('hides anything inactive or malformed', () => {
    for (const bad of [
      null, 'x', { ...on, active: false }, { ...on, active: 'true' }, { ...on, url: 'http://acme.example' },
      { ...on, url: 'javascript:alert(1)' }, { ...on, text: '  ' }, { ...on, label: '' }, { ...on, until: '11/11/2026' },
    ]) expect(activeSponsor(bad, '2026-11-04')).toBeNull()
    expect(activeSponsor(on, 'today')).toBeNull()
  })
  it('waits for an optional first day booked in advance', () => {
    const bf = { ...on, from: '2026-11-23', until: '2026-11-30' }
    expect(activeSponsor(bf, '2026-11-22')).toBeNull()
    expect(activeSponsor(bf, '2026-11-23')?.label).toBe('Acme')
    expect(activeSponsor(bf, '2026-11-30')?.until).toBe('2026-11-30')
    expect(activeSponsor(bf, '2026-12-01')).toBeNull()
    expect(activeSponsor({ ...on, from: '' }, '2026-11-04')?.label).toBe('Acme')
    expect(activeSponsor({ ...on, from: null }, '2026-11-04')?.label).toBe('Acme')
    for (const from of ['23/11/2026', 20261123, '2026-11-12'])
      expect(activeSponsor({ ...on, from }, '2026-11-11')).toBeNull()
  })
  it('reports a week booked ahead only before it starts, and only if it will really show', () => {
    const bf = { ...on, from: '2026-11-23', until: '2026-11-30' }
    expect(bookedSponsor(bf, '2026-11-06')).toEqual({ from: '2026-11-23', until: '2026-11-30' })
    expect(bookedSponsor(bf, '2026-11-22')).toEqual({ from: '2026-11-23', until: '2026-11-30' })
    for (const day of ['2026-11-23', '2026-11-30', '2026-12-01']) expect(bookedSponsor(bf, day)).toBeNull()
    for (const bad of [
      null, 'x', on, { ...bf, active: false }, { ...bf, from: '' }, { ...bf, from: null }, { ...bf, from: '23/11/2026' },
      { ...bf, from: 20261123 }, { ...bf, from: '2026-12-01' }, { ...bf, url: 'http://acme.example' }, { ...bf, text: '' },
      { ...bf, until: '30/11/2026' },
    ]) expect(bookedSponsor(bad, '2026-11-06')).toBeNull()
    expect(bookedSponsor(bf, 'today')).toBeNull()
    expect(bookedSponsor(file, '2026-11-06')).toBeNull()
  })
  it('keeps only an https image and one clean line of text', () => {
    expect(activeSponsor({ ...on, image: 'https://acme.example/a.png' }, '2026-11-04')?.image).toBe('https://acme.example/a.png')
    expect(activeSponsor({ ...on, image: 'http://acme.example/a.png' }, '2026-11-04')?.image).toBeNull()
    expect(activeSponsor({ ...on, text: 'a\n  b' }, '2026-11-04')?.text).toBe('a b')
  })
  it('ships switched off', () => {
    expect(file.active).toBe(false)
    expect(activeSponsor(file, '2026-11-04')).toBeNull()
  })
})
