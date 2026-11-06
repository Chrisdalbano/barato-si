// The self-serve sponsored slot. app/data/sponsor.json is committed by hand (see
// UI-NOTES.md, "Turning a sponsor on"); this decides whether it shows. Pure, so
// tests and the server agree. Anything malformed means no slot, never a broken one.

export interface Sponsor { label: string; text: string; url: string; until: string; image: string | null }

const DAY = /^\d{4}-\d{2}-\d{2}$/
const https = (v: unknown): v is string => typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/.test(v.trim())
const line = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/**
 * The sponsor to show on `today` (YYYY-MM-DD, the build date), or null. `until` is the last day it shows.
 * `from` is optional: the first day it shows, so a week booked in advance (Black Friday week) can be
 * committed early. A `from` that is present but malformed, or after `until`, means no slot.
 */
export function activeSponsor(raw: unknown, today: string): Sponsor | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (s.active !== true) return null
  const text = line(s.text, 160)
  const label = line(s.label, 60)
  const until = typeof s.until === 'string' && DAY.test(s.until) ? s.until : ''
  if (!text || !label || !until || !https(s.url) || !DAY.test(today) || until < today) return null
  if (s.from != null && s.from !== '') {
    if (typeof s.from !== 'string' || !DAY.test(s.from) || s.from > until || s.from > today) return null
  }
  return { label, text, url: (s.url as string).trim(), until, image: https(s.image) ? (s.image as string).trim() : null }
}

/**
 * A week booked in advance that has not started yet on `today`: its first and last day, or null.
 * It is the same gate as activeSponsor() asked on the `from` day, so only a booking that will really
 * show counts. /anunciate uses it to say the week is taken while the Stripe button is still up.
 */
export function bookedSponsor(raw: unknown, today: string): { from: string; until: string } | null {
  if (!raw || typeof raw !== 'object' || !DAY.test(today)) return null
  const from = (raw as Record<string, unknown>).from
  if (typeof from !== 'string' || !DAY.test(from) || from <= today) return null
  const s = activeSponsor(raw, from)
  return s ? { from, until: s.until } : null
}
