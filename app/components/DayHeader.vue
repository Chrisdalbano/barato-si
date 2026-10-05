<script setup lang="ts">
import type { DayView } from '~/composables/useDeals'

const props = defineProps<{ day: DayView; title?: string; level?: 1 | 2 }>()

const working = computed(() => props.day.sources.filter(s => s.ok))
const resting = computed(() => props.day.sources.filter(s => !s.ok))
const errors = computed(() => props.day.deals.filter(d => d.flag === 'error-probable').length)
const chollos = computed(() => props.day.deals.filter(d => d.flag === 'chollo').length)
</script>

<template>
  <header class="day">
    <p class="eyebrow">{{ title ?? 'Ofertas del día' }}</p>
    <component :is="level === 2 ? 'h2' : 'h1'" class="day__date">{{ formatDay(day.date) }}</component>
    <dl class="day__stats">
      <div><dt>Ofertas</dt><dd>{{ day.count }}</dd></div>
      <div><dt>Chollos</dt><dd>{{ chollos }}</dd></div>
      <div><dt>Errores probables</dt><dd>{{ errors }}</dd></div>
      <div>
        <dt>Generado</dt>
        <dd class="day__time"><time :datetime="day.generatedAt">{{ formatGenerated(day.generatedAt) }}</time></dd>
      </div>
    </dl>
    <div class="day__sources">
      <template v-if="working.length">
        Fuente{{ working.length > 1 ? 's' : '' }}:
        <template v-for="(s, i) in working" :key="s.name"><span v-if="i">, </span><strong>{{ sourceName(s.name) }}</strong> ({{ s.count }})</template>.
      </template>
      <template v-else>Hoy no respondió ninguna fuente.</template>
      <details v-if="resting.length" class="day__more">
        <summary>fuentes</summary>
        <p class="day__note">
          {{ working.length }} de {{ day.sources.length }} activas. Las demás están en pausa: o su robots.txt no lo permite,
          o sus términos piden permiso por escrito, o no hay un feed abierto.
        </p>
        <ul>
          <li v-for="s in day.sources" :key="s.name">
            <span class="day__src">{{ sourceName(s.name) }}</span>
            <span v-if="s.ok">{{ s.count }} ofertas</span>
            <span v-else class="day__err">{{ s.errorEs ?? s.error ?? 'sin respuesta' }}</span>
          </li>
        </ul>
      </details>
    </div>
  </header>
</template>

<style scoped>
.day { padding: clamp(40px, 6vw, 88px) 0 clamp(28px, 4vw, 48px); }
.day__date { margin: 8px 0 0; font-size: clamp(2.5rem, 7vw, 5.75rem); line-height: 0.95; font-weight: 600; letter-spacing: -0.045em; }
.day__date::first-letter { text-transform: uppercase; }
.day__stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 24px; margin: clamp(28px, 4vw, 48px) 0 0; }
.day__stats div { border-top: 1px solid var(--fg-primary); padding-top: 10px; }
.day__stats dt { font-size: 0.75rem; color: var(--fg-secondary); }
.day__stats dd { margin: 4px 0 0; font-size: clamp(1.75rem, 3.4vw, 2.75rem); font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.day__stats dd.day__time { font-size: clamp(1.125rem, 2vw, 1.5rem); padding-top: 0.35em; letter-spacing: -0.01em; }
.day__sources { margin: 20px 0 0; font-size: 0.875rem; color: var(--fg-secondary); }
.day__sources strong { color: var(--fg-primary); font-weight: 600; }
.day__more { display: inline; margin-left: 0.6em; }
.day__more summary { display: inline; cursor: pointer; color: var(--link-fg); text-decoration: underline; text-underline-offset: 3px; list-style: none; }
.day__more summary::-webkit-details-marker { display: none; }
.day__more[open] { display: block; margin: 14px 0 0; padding: 16px 0 0; border-top: 1px solid var(--border); }
.day__more[open] summary { display: none; }
.day__note { margin: 0 0 12px; max-width: var(--container-max-prose); }
.day__more ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.day__more li { display: grid; grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr); gap: 12px; }
.day__src { color: var(--fg-primary); }
.day__err { color: var(--fg-muted); }
@media (max-width: 640px) {
  .day__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 16px; }
  .day__more li { grid-template-columns: 1fr; gap: 0; }
}
</style>
