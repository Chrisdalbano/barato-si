<script setup lang="ts">
import type { DealsFile } from '~~/lib/types'
import type { OraclePrediction } from '~/utils/extras'

definePageMeta({ alias: ['/en/si'] })

const { locale, t } = useLang()
usePageSeo('si', { es: '.si', en: '.si' })

const oracle = await useOracle()

// Only what the list needs from today's deals: the outbound link and the
// picture for each predicted id, so this page's payload stays small.
const { data: links } = await useAsyncData('si-links', async () => {
  const ids = new Set((oracle.value?.predictions ?? []).map(p => p.dealId))
  if (!ids.size) return {} as Record<string, { href: string; store: string; image: string | null }>
  try {
    const file = (import.meta.server
      ? (await import('../../public/api/deals.json')).default
      : await $fetch('/api/deals.json')) as unknown as DealsFile
    const out: Record<string, { href: string; store: string; image: string | null }> = {}
    for (const d of file.deals ?? []) {
      if (!ids.has(d.id)) continue
      const v = toDealView(d)
      out[d.id] = { href: linkFor(v), store: v.store, image: v.image }
    }
    return out
  } catch { return {} as Record<string, { href: string; store: string; image: string | null }> }
}, { watch: [oracle] })

const o = computed(() => oracle.value ?? null)
const horizon = computed(() => o.value?.horizonDays ?? 14)
const threshold = computed(() => o.value?.dropThresholdPct ?? 5)
const ORDER: Record<string, number> = { espera: 0, compra: 1, aprendiendo: 2 }
const decided = computed(() => (o.value?.predictions ?? [])
  .filter(p => p.verdict !== 'aprendiendo')
  .sort((a, b) => ORDER[a.verdict]! - ORDER[b.verdict]! || b.pDrop - a.pDrop))
const learningCount = computed(() => (o.value?.predictions ?? []).filter(p => p.verdict === 'aprendiendo').length)

const sc = computed(() => o.value?.scorecard ?? null)
const graded = computed(() => !!sc.value && sc.value.resolved > 0 && sc.value.brier !== null)
const beats = computed(() => graded.value && sc.value!.baselineBrier !== null && sc.value!.brier! < sc.value!.baselineBrier!)
const three = (v: number | null) => (v === null ? '—' : formatNumber(Math.round(v * 1000) / 1000, locale.value))
const sinceText = computed(() => (sc.value?.since ? formatDayMonth(sc.value.since, locale.value) : ''))
// Before the first grade: when it lands, counted from the data's own date (not the
// visitor's clock), so the prerendered text and hydration agree.
const dueText = computed(() => {
  const due = sc.value?.firstDue, today = o.value?.date
  if (graded.value || !due || !today) return ''
  const n = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  return Number.isFinite(n) ? t.value.si.due(formatDayMonth(due, locale.value), n) : ''
})
const cat = (c: string | null) => (c ? categoryLabel(c, locale.value) : '—')

const out = useOutbound()
const linkOf = (p: OraclePrediction) => {
  const l = links.value?.[p.dealId]
  return l ? out.href({ url: l.href }) : ''
}
const relOf = (p: OraclePrediction) => out.rel({ url: links.value?.[p.dealId]?.href ?? '' })
const pct = (v: number) => formatShare(v, locale.value)
</script>

<template>
  <div class="wrap si">
    <header class="si__head">
      <p class="eyebrow">{{ t.si.eyebrow }}</p>
      <h1 class="si__title">
        {{ t.si.title }}<span class="si__dot" aria-hidden="true">.</span>
        <span class="si__exp">({{ t.si.experimental }})</span>
      </h1>
      <p class="si__lede">{{ t.si.lede(horizon) }}</p>
    </header>

    <section class="si__sec si__how" aria-labelledby="si-how">
      <h2 id="si-how">{{ t.si.howTitle }}</h2>
      <ol class="si__steps">
        <li>{{ t.si.how1 }}</li>
        <li>{{ t.si.how2(threshold, horizon) }}</li>
        <li>{{ t.si.how3 }}</li>
        <li>{{ t.si.how4 }}</li>
      </ol>
      <p class="si__caveat">{{ t.si.caveat }}</p>
      <p class="si__lore">{{ t.lore.oracle }} <span aria-hidden="true">—</span> {{ t.lore.signature }}</p>
    </section>

    <section class="si__sec" aria-labelledby="si-score">
      <h2 id="si-score">{{ t.si.scoreTitle }}</h2>
      <p class="si__note">{{ t.si.scoreLede }}</p>
      <template v-if="graded && sc">
        <dl class="score">
          <div><dt>{{ t.si.resolved }}</dt><dd>{{ formatNumber(sc.resolved, locale) }}</dd></div>
          <div class="score__main"><dt>{{ t.si.brier }}</dt><dd>{{ three(sc.brier) }}</dd></div>
          <div><dt>{{ t.si.baseline }}</dt><dd>{{ three(sc.baselineBrier) }}</dd></div>
        </dl>
        <p class="score__verdict" :class="{ 'score__verdict--good': beats }">{{ beats ? t.si.better : t.si.worse }}</p>
        <p class="si__note">{{ t.si.brierNote }}</p>
        <div v-if="sc.buckets.length" class="calib">
          <h3>{{ t.si.calibTitle }}</h3>
          <p class="si__note">{{ t.si.calibNote }}</p>
          <table class="calib__tbl">
            <thead>
              <tr><th scope="col">{{ t.si.predicted }}</th><th scope="col" class="num">{{ t.si.count }}</th><th scope="col">{{ t.si.hit }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="b in sc.buckets" :key="`${b.lo}-${b.hi}`">
                <td class="calib__range">{{ bucketPct(b.lo) }}–{{ bucketPct(b.hi) }}{{ locale === 'en' ? '%' : ' %' }}</td>
                <td class="num">{{ formatNumber(b.n, locale) }}</td>
                <td>
                  <span class="calib__bar" aria-hidden="true">
                    <span class="calib__expect" :style="{ left: `${(bucketPct(b.lo) + bucketPct(b.hi)) / 2}%` }" />
                    <span class="calib__fill" :style="{ width: `${(b.hitRate ?? 0) * 100}%` }" />
                  </span>
                  <span class="calib__n">{{ pct(b.hitRate ?? 0) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="si__fine">{{ sc.since ? t.si.since(sinceText) : '' }} {{ o?.model ? t.si.model(o.model) : '' }}</p>
      </template>
      <template v-else>
        <p class="si__learning">{{ t.si.learning(sinceText) }}</p>
        <p v-if="dueText" class="si__due">{{ dueText }}</p>
      </template>
    </section>

    <section class="si__sec" aria-labelledby="si-list">
      <h2 id="si-list">{{ t.si.listTitle }}</h2>
      <p v-if="!o" class="si__note">{{ t.si.missing }}</p>
      <p v-else-if="!decided.length && learningCount" class="si__learning">{{ t.si.allLearning(learningCount) }}</p>
      <p v-else-if="!decided.length" class="si__note">{{ t.si.noPredictions }}</p>
      <ol v-else class="pred">
        <li v-for="p in decided" :key="p.dealId" class="pred__row" :class="`pred__row--${p.verdict}`">
          <p class="pred__verdict">
            <span class="pred__v">{{ t.si.verdicts[p.verdict] }}</span>
            <span class="pred__vn">{{ t.si.verdictNotes[p.verdict] }}</span>
          </p>
          <div class="pred__what">
            <a v-if="linkOf(p)" :href="linkOf(p)" :rel="relOf(p)" target="_blank" class="pred__title">{{ p.title }}</a>
            <span v-else class="pred__title">{{ p.title }}</span>
            <span class="pred__basis">{{ t.si.basis(p.basis.observations, cat(p.basis.category)) }}</span>
          </div>
          <p class="pred__price">{{ formatPrice(p.price, p.currency, moneyDigits(p.price), locale) }}</p>
          <p class="pred__p">
            <strong>{{ pct(p.pDrop) }}</strong>
            <span>{{ t.si.pDrop(threshold, p.horizonDays) }}</span>
          </p>
        </li>
      </ol>
      <p v-if="learningCount && decided.length" class="si__fine">{{ t.si.verdicts.aprendiendo }}: {{ formatNumber(learningCount, locale) }}. {{ t.si.verdictNotes.aprendiendo }}</p>
    </section>
  </div>
</template>

<style scoped>
.si__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); max-width: 62rem; }
.si__title { margin: 6px 0 12px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1.02; font-weight: 600; letter-spacing: -0.045em; }
.si__dot { color: var(--accent-lead); }
.si__exp { display: inline-block; margin-left: 0.3em; font-family: var(--font-mono); font-size: 0.32em; font-weight: 400; letter-spacing: 0.02em; color: var(--fg-secondary); vertical-align: 0.6em; }
.si__lede { margin: 0; max-width: var(--container-max-prose); font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-secondary); }

.si__sec { padding: clamp(20px, 3vw, 32px) 0; border-top: 2px solid var(--fg-primary); }
.si__sec h2 { margin: 0 0 10px; font-size: clamp(1.25rem, 2.4vw, 1.625rem); letter-spacing: -0.025em; font-weight: 600; }
.si__note { margin: 0 0 12px; max-width: var(--container-max-prose); font-size: 0.875rem; color: var(--fg-secondary); }
.si__fine { margin: 10px 0 0; font-size: 0.75rem; color: var(--fg-muted); }
.si__learning { margin: 0; max-width: var(--container-max-prose); font-size: 1.0625rem; color: var(--fg-primary); }
.si__due { margin: 8px 0 0; font-family: var(--font-mono); font-size: 0.875rem; color: var(--accent-lead); font-variant-numeric: tabular-nums; }

.si__steps { margin: 0 0 14px; padding: 0; list-style: none; counter-reset: step; max-width: var(--container-max-prose); }
.si__steps li { counter-increment: step; display: grid; grid-template-columns: 2rem minmax(0, 1fr); padding: 8px 0; border-bottom: 1px solid var(--border); }
.si__steps li::before { content: counter(step); font-family: var(--font-mono); font-size: 0.8125rem; color: var(--accent-lead); padding-top: 2px; }
.si__caveat { margin: 0 0 8px; max-width: var(--container-max-prose); font-size: 0.875rem; color: var(--fg-secondary); }
.si__lore { margin: 0; font-size: 0.8125rem; font-style: italic; color: var(--fg-muted); }

.score { display: grid; grid-template-columns: repeat(3, minmax(0, max-content)); gap: 8px clamp(24px, 4vw, 56px); margin: 6px 0 8px; }
.score div { display: grid; gap: 2px; }
.score dt { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-secondary); }
.score dd { margin: 0; font-family: var(--font-mono); font-size: 1.75rem; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.score__main dd { color: var(--accent-lead); }
.score__verdict { margin: 0 0 10px; font-weight: 600; }
.score__verdict--good { color: var(--accent-lead); }

.calib { margin-top: 16px; }
.calib h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 600; }
.calib__tbl { width: 100%; max-width: 40rem; border-collapse: collapse; font-size: 0.8125rem; }
.calib__tbl th { text-align: left; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-secondary); padding: 0 12px 6px 0; border-bottom: 1px solid var(--fg-primary); }
.calib__tbl td { padding: 6px 12px 6px 0; border-bottom: 1px solid var(--border); vertical-align: middle; }
.calib__tbl .num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.calib__range { font-family: var(--font-mono); white-space: nowrap; }
.calib__bar { position: relative; display: inline-block; width: min(14rem, 50vw); height: 8px; margin-right: 8px; border-bottom: 1px solid var(--border-strong); vertical-align: middle; }
.calib__fill { position: absolute; left: 0; bottom: 0; height: 4px; background: var(--fg-primary); }
.calib__expect { position: absolute; bottom: -3px; width: 2px; height: 12px; margin-left: -1px; background: var(--accent-lead); }
.calib__n { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.pred { margin: 0; padding: 0; list-style: none; }
.pred__row { display: grid; grid-template-columns: 9rem minmax(0, 1fr) 7rem 13rem; gap: 6px 20px; align-items: baseline; padding: 10px 0 10px 12px; border-top: 1px solid var(--border); border-left: 3px solid var(--accent-lead); }
.pred__row--compra { border-left: 1px solid var(--fg-primary); padding-left: 14px; }
.pred__row p { margin: 0; }
.pred__verdict { display: grid; gap: 1px; }
.pred__v { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.pred__row--espera .pred__v { color: var(--accent-lead); }
.pred__vn { font-size: 0.6875rem; color: var(--fg-muted); }
.pred__what { display: grid; gap: 2px; min-width: 0; }
.pred__title { font-size: 0.9375rem; font-weight: 500; color: var(--fg-primary); text-decoration: none; overflow-wrap: anywhere; }
a.pred__title:hover { text-decoration: underline; text-underline-offset: 3px; }
.pred__basis { font-size: 0.75rem; color: var(--fg-muted); }
.pred__price { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; word-spacing: -0.35em; }
.pred__p { display: grid; gap: 1px; }
.pred__p strong { font-family: var(--font-mono); font-size: 1.125rem; font-variant-numeric: tabular-nums; }
.pred__p span { font-size: 0.6875rem; color: var(--fg-secondary); }

@media (max-width: 760px) {
  .score { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pred__row { grid-template-columns: minmax(0, 1fr) auto; }
  .pred__verdict { grid-column: 1 / -1; }
  .pred__price { text-align: left; }
}
</style>
