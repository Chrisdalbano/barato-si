import { computed } from 'vue'
import { es } from '../i18n/es'
import { en } from '../i18n/en'
import type { Dict } from '../i18n/es'
import { localeOfPath, localePath } from '../utils/locale'
import type { Locale } from '../utils/locale'

const DICTS: Record<Locale, Dict> = { es, en }

/**
 * The page language comes from the path (/en/... is English), so the server and
 * the client always agree and every language has its own crawlable URL.
 * `t` is the dictionary, `lp` turns a Spanish path into the current language's.
 */
export function useLang() {
  const route = useRoute()
  const locale = computed<Locale>(() => localeOfPath(route.path))
  const t = computed<Dict>(() => DICTS[locale.value])
  const lp = (path: string) => localePath(path, locale.value)
  return { locale, t, lp }
}
