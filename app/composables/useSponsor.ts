import raw from '../data/sponsor.json'
import { activeSponsor, bookedSponsor } from '../utils/sponsor'

/**
 * Today's sponsor, or null. "Today" is the build date, decided once on the server
 * and carried to the client in the payload, so the slot and the footer line never
 * disagree between the prerendered HTML and hydration.
 */
export function useSponsor() {
  const today = useState('build-date', () => new Date().toISOString().slice(0, 10))
  return computed(() => activeSponsor(raw, today.value))
}

/** A week booked ahead that starts after the build date ({ from, until }), or null. Same build date as useSponsor(). */
export function useBookedSponsor() {
  const today = useState('build-date', () => new Date().toISOString().slice(0, 10))
  return computed(() => bookedSponsor(raw, today.value))
}
