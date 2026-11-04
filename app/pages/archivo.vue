<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

definePageMeta({ alias: ['/en/archivo'] })

const { locale, t, lp } = useLang()
usePageSeo('archivo', { es: 'Archivo', en: 'Archive' })

const index = await useArchiveIndex()
const route = useRoute()
const router = useRouter()

// The chosen day lives in ?dia= and is fetched in the browser.
const selected = ref('')
const day = ref<DayView | null>(null)
const state = ref<'idle' | 'loading' | 'error'>('idle')
const errors = computed(() => byEvidence((day.value?.deals ?? []).filter(d => d.errorScore >= ERROR_LEVELS[0])))

async function load(date: string) {
  selected.value = date
  day.value = null
  if (!isDay(date)) { state.value = 'idle'; return }
  state.value = 'loading'
  try {
    day.value = await fetchDay(date)
    state.value = 'idle'
  } catch {
    state.value = 'error'
  }
}

onMounted(() => {
  watch(() => route.query.dia, (d) => {
    const date = String(Array.isArray(d) ? d[0] : d ?? '')
    if (date !== selected.value || !day.value) load(date)
  }, { immediate: true })
})

function pick(date: string) {
  router.replace({ query: { dia: date } })
}
</script>

<template>
  <div class="wrap">
    <header class="arch__head">
      <p class="eyebrow">{{ t.archive.eyebrow }}</p>
      <h1 class="arch__title">{{ t.archive.title }}<span class="arch__dot" aria-hidden="true">.</span></h1>
      <p class="arch__lede">{{ t.archive.lede }}</p>
    </header>

    <nav class="days" :aria-label="t.archive.daysAria">
      <p v-if="!index?.days.length" class="arch__empty">{{ t.archive.none }}</p>
      <ol v-else>
        <li v-for="d in index.days" :key="d">
          <a
            :href="`${lp('/archivo')}?dia=${d}`" :aria-current="d === selected ? 'page' : undefined"
            @click.prevent="pick(d)"
          >
            <span class="days__d">{{ formatShortDay(d, locale) }}</span>
            <span class="days__iso">{{ d }}</span>
          </a>
        </li>
      </ol>
    </nav>

    <p v-if="state === 'loading'" class="arch__status">{{ t.archive.loading(selected) }}</p>
    <p v-else-if="state === 'error'" class="arch__status">
      {{ t.archive.failA }} <code>/api/deals/{{ selected }}.json</code>. {{ t.archive.failB }}
    </p>
    <template v-else-if="day">
      <DayHeader :day="day" :level="2" errors-href="#errores" />
      <EvidenceBoard v-if="errors.length" :deals="errors" :level="3" :more="false" />
      <DealExplorer
        v-if="day.deals.length" :key="day.date" :deals="day.deals" :generated-at="day.generatedAt"
        :shown-above="errors.map(d => d.id)"
      />
      <p v-else class="arch__status">{{ t.archive.dayNothing }}</p>
      <GateReport v-if="day.gate" :gate="day.gate" />
    </template>
    <p v-else-if="index?.days.length" class="arch__status">{{ t.archive.pick }}</p>
  </div>
</template>

<style scoped>
.arch__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); }
.arch__title { margin: 6px 0 10px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.arch__dot { color: var(--accent-lead); }
.arch__lede { margin: 0; color: var(--fg-secondary); }
.days { border-top: 2px solid var(--fg-primary); padding: 16px 0 8px; }
.days ol { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); }
.days a { display: grid; gap: 2px; padding: 10px 12px 12px 0; color: var(--fg-primary); text-decoration: none; border-bottom: 1px solid var(--border); }
.days a:hover .days__d { text-decoration: underline; text-underline-offset: 3px; }
.days a[aria-current="page"] { color: var(--accent-lead); border-bottom: 2px solid var(--accent-lead); }
.days__d { font-weight: 600; }
.days__iso { font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); }
.arch__status, .arch__empty { margin: 24px 0; color: var(--fg-secondary); }
</style>
