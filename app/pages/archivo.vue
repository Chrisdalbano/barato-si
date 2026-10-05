<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

useSeoMeta({
  title: 'Archivo · barato.si',
  description: 'Las ofertas de días anteriores en barato.si. Se guardan los últimos 30 días.',
  ogTitle: 'Archivo · barato.si',
  ogUrl: `${SITE}/archivo`,
})
useHead({ link: [{ rel: 'canonical', href: `${SITE}/archivo` }] })

const index = await useArchiveIndex()
const route = useRoute()
const router = useRouter()

// The chosen day lives in ?dia= and is fetched in the browser.
const selected = ref('')
const day = ref<DayView | null>(null)
const state = ref<'idle' | 'loading' | 'error'>('idle')

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
      <p class="eyebrow">Archivo</p>
      <h1 class="arch__title">Días anteriores</h1>
      <p class="arch__lede">
        Cada día queda guardado tal como se publicó. Se conservan los últimos 30.
      </p>
    </header>

    <nav class="days" aria-label="Días disponibles">
      <p v-if="!index?.days.length" class="arch__empty">Todavía no hay días archivados.</p>
      <ol v-else>
        <li v-for="d in index.days" :key="d">
          <a
            :href="`/archivo?dia=${d}`" :aria-current="d === selected ? 'page' : undefined"
            @click.prevent="pick(d)"
          >
            <span class="days__d">{{ formatShortDay(d) }}</span>
            <span class="days__iso">{{ d }}</span>
          </a>
        </li>
      </ol>
    </nav>

    <p v-if="state === 'loading'" class="arch__status">Cargando {{ selected }}…</p>
    <p v-else-if="state === 'error'" class="arch__status">
      No se pudo cargar <code>/api/deals/{{ selected }}.json</code>. Puede que ese día ya no esté en el archivo.
    </p>
    <template v-else-if="day">
      <DayHeader :day="day" title="Archivo" :level="2" />
      <DealList v-if="day.deals.length" :key="day.date" :deals="day.deals" :generated-at="day.generatedAt" />
      <p v-else class="arch__status">Ese día no hubo ofertas.</p>
    </template>
    <p v-else-if="index?.days.length" class="arch__status">Elige un día.</p>
  </div>
</template>

<style scoped>
.arch__head { padding: clamp(40px, 6vw, 88px) 0 clamp(20px, 3vw, 32px); }
.arch__title { margin: 8px 0 12px; font-size: clamp(2.25rem, 6vw, 4.75rem); line-height: 0.98; font-weight: 600; letter-spacing: -0.045em; }
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
