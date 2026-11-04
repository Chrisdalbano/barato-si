import raw from '../data/sponsor.json'
import { activeSponsor } from '../utils/sponsor'

/**
 * Today's sponsor, or null. "Today" is the build date, decided once on the server
 * and carried to the client in the payload, so the slot and the footer line never
 * disagree between the prerendered HTML and hydration.
 */
export function useSponsor() {
  const today = useState('build-date', () => new Date().toISOString().slice(0, 10))
  return computed(() => activeSponsor(raw, today.value))
}
