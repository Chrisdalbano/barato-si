<script setup lang="ts">
import { dropDetail, errorDetail, lowDetail, weekCopy, weekTitle } from '~~/lib/digest'
import type { WeekDeal } from '~~/lib/types'

// "La semana de Don Centavo": the pipeline rebuilds public/api/week.json on every
// run (lib/digest.ts) and this page renders it. Every sentence with a number comes
// from weekCopy(), the same function that writes /semana.xml, so the page and the
// feed never disagree. Rows have fixed-size pictures: nothing moves when they load.
definePageMeta({ alias: ['/en/week'] })

const { locale, t } = useLang()
usePageSeo('semana', { es: 'La semana', en: 'The week' })

const week = await useWeek()
const w = computed(() => week.value ?? null)
const c = computed(() => (w.value ? weekCopy(w.value, locale.value) : null))

const out = useOutbound()
const href = (d: WeekDeal) => out.href(d)
const rel = (d: WeekDeal) => out.rel(d)
const pct = (v: number) => formatDiscount(v, locale.value)
</script>

<template>
  <div class="wrap wk">
    <header class="wk__head">
      <p class="eyebrow">{{ t.week.eyebrow }}</p>
      <h1 class="wk__title">{{ c?.title ?? t.next.week }}<span class="wk__dot" aria-hidden="true">.</span></h1>
      <p v-if="w && c" class="wk__range"><time :datetime="w.from">{{ c.range }}</time></p>
      <p v-if="c" class="wk__lede">{{ c.lede }}</p>
      <p v-if="c?.thin" class="wk__thin">{{ c.thin }}</p>
      <p class="wk__rss"><a href="/semana.xml" hreflang="es">{{ t.week.rss }}</a> <span>{{ t.week.rssNote }}</span></p>
    </header>

    <template v-if="w && c">
      <section class="wk__sec" aria-labelledby="wk-drops">
        <h2 id="wk-drops">{{ c.drops.title }}</h2>
        <p class="wk__note">{{ c.drops.note }}</p>
        <ol v-if="w.drops.length" class="wk__list">
          <li v-for="x in w.drops" :key="x.deal.id" class="wk__item">
            <span class="wk__img"><img v-if="x.deal.image" :src="x.deal.image" alt="" loading="lazy" decoding="async" width="56" height="56"></span>
            <div class="wk__body">
              <a class="wk__name" :href="href(x.deal)" :rel="rel(x.deal)" target="_blank">{{ weekTitle(x.deal.title) }}</a>
              <p class="wk__meta"><span class="wk__store">{{ x.deal.store }}</span> {{ dropDetail(x, locale) }}</p>
            </div>
            <span class="wk__fig">{{ pct(x.pct) }}</span>
          </li>
        </ol>
        <p v-else class="wk__empty">{{ c.drops.empty }}</p>
      </section>

      <section class="wk__sec" aria-labelledby="wk-lows">
        <h2 id="wk-lows">{{ c.lows.title }}</h2>
        <p class="wk__note">{{ c.lows.note }}</p>
        <ol v-if="w.lows.length" class="wk__list">
          <li v-for="x in w.lows" :key="x.deal.id" class="wk__item">
            <span class="wk__img"><img v-if="x.deal.image" :src="x.deal.image" alt="" loading="lazy" decoding="async" width="56" height="56"></span>
            <div class="wk__body">
              <a class="wk__name" :href="href(x.deal)" :rel="rel(x.deal)" target="_blank">{{ weekTitle(x.deal.title) }}</a>
              <p class="wk__meta"><span class="wk__store">{{ x.deal.store }}</span> {{ lowDetail(x, locale) }}</p>
            </div>
            <span class="wk__fig wk__fig--quiet">{{ pct((1 - x.price / x.priorHigh) * 100) }}</span>
          </li>
        </ol>
        <p v-else class="wk__empty">{{ c.lows.empty }}</p>
      </section>

      <section class="wk__sec" aria-labelledby="wk-errors">
        <h2 id="wk-errors">{{ c.errors.title }}</h2>
        <p class="wk__note">{{ c.errors.note }}</p>
        <ol v-if="w.errors.length" class="wk__list">
          <li v-for="x in w.errors" :key="x.deal.id" class="wk__item">
            <span class="wk__img"><img v-if="x.deal.image" :src="x.deal.image" alt="" loading="lazy" decoding="async" width="56" height="56"></span>
            <div class="wk__body">
              <a class="wk__name" :href="href(x.deal)" :rel="rel(x.deal)" target="_blank">{{ weekTitle(x.deal.title) }}</a>
              <p class="wk__meta"><span class="wk__store">{{ x.deal.store }}</span> {{ errorDetail(x, locale) }}</p>
              <ul v-if="x.signals.length" class="wk__signals" :aria-label="t.week.signals" lang="es">
                <li v-for="s in x.signals" :key="s">{{ s }}</li>
              </ul>
              <p v-if="x.note" class="wk__ai">{{ c.errors.notePrefix }}: <q lang="es">{{ x.note }}</q></p>
            </div>
            <span class="wk__fig wk__fig--err">{{ x.errorScore }}</span>
          </li>
        </ol>
        <p v-else class="wk__empty">{{ c.errors.empty }}</p>
      </section>

      <section class="wk__sec" aria-labelledby="wk-model">
        <h2 id="wk-model">{{ c.forecast.title }}</h2>
        <p v-for="line in c.forecast.lines" :key="line" class="wk__line">{{ line }}</p>
        <p class="wk__note"><NuxtLink :to="locale === 'en' ? '/en/si' : '/si'">.si</NuxtLink></p>
      </section>

      <aside class="wk__rule" :aria-label="t.lore.eyebrow">
        <p class="eyebrow">{{ t.lore.eyebrow }}</p>
        <p class="wk__ruletext">{{ c.rule }}</p>
        <p class="wk__sig"><span aria-hidden="true">—</span> {{ c.signature }}</p>
      </aside>

      <p class="wk__fine">{{ t.week.updated }} <time :datetime="w.generatedAt">{{ formatGenerated(w.generatedAt, locale) }}</time></p>
    </template>
    <section v-else class="calm">
      <p class="calm__big">{{ t.week.missing }}</p>
    </section>
  </div>
</template>

<style scoped>
.wk__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); }
.wk__title { margin: 6px 0 8px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.wk__dot { color: var(--accent-lead); }
.wk__range { margin: 0 0 10px; font-family: var(--font-mono); font-size: 0.8125rem; color: var(--fg-secondary); }
.wk__lede { margin: 0; max-width: var(--container-max-prose); font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-secondary); }
.wk__thin { margin: 10px 0 0; max-width: var(--container-max-prose); font-size: 0.9375rem; color: var(--fg-primary); }
.wk__rss { margin: 12px 0 0; font-size: 0.8125rem; color: var(--fg-muted); }
.wk__rss a { color: var(--fg-primary); text-underline-offset: 3px; margin-right: 6px; }
.wk__rss a:hover { color: var(--link-fg); }

.wk__sec { padding: 16px 0 20px; border-top: 1px solid var(--border); }
.wk__sec:first-of-type { border-top: 2px solid var(--fg-primary); }
.wk__sec h2 { margin: 0 0 4px; font-size: 1.125rem; font-weight: 600; letter-spacing: -0.02em; }
.wk__note { margin: 0 0 12px; max-width: var(--container-max-prose); font-size: 0.875rem; color: var(--fg-secondary); }
.wk__note a { color: var(--fg-primary); text-underline-offset: 3px; }
.wk__empty, .wk__line { margin: 0 0 6px; max-width: var(--container-max-prose); color: var(--fg-primary); }

.wk__list { margin: 0; padding: 0; list-style: none; }
.wk__item { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: 10px 0; border-top: 1px solid var(--border); }
.wk__item:first-child { border-top: 0; }
.wk__img { display: block; width: 56px; height: 56px; overflow: hidden; background: var(--bg-sunken, transparent); border: 1px solid var(--border); }
.wk__img img { display: block; width: 100%; height: 100%; object-fit: contain; }
.wk__body { min-width: 0; }
.wk__name { color: var(--fg-primary); font-weight: 500; text-decoration: none; overflow-wrap: anywhere; }
.wk__name:hover { color: var(--link-fg); text-decoration: underline; text-underline-offset: 3px; }
.wk__meta { margin: 2px 0 0; font-size: 0.8125rem; color: var(--fg-secondary); font-variant-numeric: tabular-nums; }
.wk__store { font-weight: 600; color: var(--fg-primary); margin-right: 4px; }
.wk__signals { margin: 6px 0 0; padding-left: 1.1em; font-size: 0.8125rem; color: var(--fg-secondary); }
.wk__ai { margin: 6px 0 0; font-size: 0.8125rem; color: var(--fg-secondary); }
.wk__fig { font-family: var(--font-mono); font-size: 1rem; font-weight: 600; color: var(--accent-lead); white-space: nowrap; font-variant-numeric: tabular-nums; }
.wk__fig--quiet { color: var(--fg-secondary); }
.wk__fig--err { color: var(--fg-primary); }

.wk__rule { margin: 8px 0 0; padding: 18px 0; border-top: 2px solid var(--fg-primary); border-bottom: 1px solid var(--border); }
.wk__rule .eyebrow { margin: 0 0 6px; }
.wk__ruletext { margin: 0; max-width: 40ch; font-size: clamp(1.25rem, 2.4vw, 1.75rem); line-height: 1.2; font-weight: 600; letter-spacing: -0.03em; }
.wk__sig { margin: 8px 0 0; font-size: 0.875rem; color: var(--fg-secondary); }
.wk__fine { margin: 16px 0 0; font-size: 0.75rem; color: var(--fg-muted); }
.calm { padding: clamp(40px, 6vw, 80px) 0; border-top: 2px solid var(--fg-primary); max-width: var(--container-max-prose); color: var(--fg-secondary); }
.calm__big { margin: 0; font-size: clamp(1.25rem, 2.5vw, 1.75rem); font-weight: 600; letter-spacing: -0.03em; color: var(--fg-primary); }
@media (max-width: 640px) {
  .wk__item { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; }
  .wk__img { width: 44px; height: 44px; }
}
</style>
