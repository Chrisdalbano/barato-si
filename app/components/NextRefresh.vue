<script setup lang="ts">
import { INTL } from '~/utils/locale'

// "Vuelve a las…": when the next refresh is due, derived from the data's own
// generatedAt and the workflow's schedule (cron 0 */3 * * *: every three hours on
// the hour, UTC). The prerendered line says UTC; after mount it switches to the
// reader's clock and, past an hour late, says the refresh is running late. One
// fixed-height line with an ellipsis, so neither change can move the page.
const props = defineProps<{ generatedAt: string }>()
const { locale, t, lp } = useLang()

const CADENCE_MS = 3 * 3600_000
const LATE_MS = 60 * 60_000
const next = computed(() => {
  const g = Date.parse(props.generatedAt)
  return Number.isFinite(g) ? Math.floor(g / CADENCE_MS) * CADENCE_MS + CADENCE_MS : null
})
const utc = computed(() => (next.value === null ? '' : `${new Date(next.value).toISOString().slice(11, 16)} UTC`))
const local = ref('')
const late = ref(false)
function update() {
  if (next.value === null) return
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  local.value = zone && !/^(?:Etc\/)?UTC$/.test(zone)
    ? `${new Intl.DateTimeFormat(INTL[locale.value], { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(next.value))} (${t.value.next.local})`
    : ''
  late.value = Date.now() > next.value + LATE_MS
}
onMounted(update)
watch(next, update)
const when = computed(() => local.value || utc.value)
</script>

<template>
  <p v-if="next !== null" class="nx">
    <span class="nx__txt"><time :datetime="new Date(next).toISOString()">{{ late ? t.next.late(when) : t.next.lead(when) }}</time></span>
    <NuxtLink :to="lp('/semana')" class="nx__link">{{ t.next.week }} <span aria-hidden="true">→</span></NuxtLink>
  </p>
</template>

<style scoped>
.nx { display: flex; align-items: baseline; gap: 16px; height: 1.9rem; margin: 0; padding: 5px 0 0; font-size: 0.8125rem; line-height: 1.4; color: var(--fg-secondary); overflow: hidden; }
.nx__txt { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.nx__link { flex: none; white-space: nowrap; color: var(--fg-primary); text-underline-offset: 3px; }
.nx__link:hover { color: var(--link-fg); }
</style>
