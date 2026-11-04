<script setup lang="ts">
import { hubSections, HUB_MIN_DEPTH } from '~/utils/hub'

// Black Friday / Cyber Monday. Not a separate list: today's deals.json and
// errors.json (the same loaders as the home page and /errores), grouped by
// utils/hub.ts. Possible errors first, then the deepest cuts with a reference,
// then the category pages built today. Empty groups say so; no countdown, no
// filler, no threshold lowered for the season.
definePageMeta({ alias: ['/en/black-friday'] })

const { locale, t, lp } = useLang()
usePageSeo('blackFriday', { es: 'Black Friday y Cyber Monday', en: 'Black Friday and Cyber Monday' })

const day = await useToday()
const errors = await useErrors()
const oracle = await useOracle()
provideOracle(oracle)
// Rows share their category page; those pages exist for every slice in today's list.
provideLanding(() => day.value?.deals)

const hub = computed(() => hubSections(day.value?.deals ?? [], errors.value?.deals ?? []))
const h = computed(() => t.value.hub)

// ItemList of exactly the rows shown, in order. Nothing shown: no ItemList.
useHead(() => {
  const d = day.value
  if (!d) return {}
  const list = offerListLd([...hub.value.errors, ...hub.value.deep], {
    id: `${siteUrl(lp('/black-friday'))}#ofertas`,
    name: h.value.listName(formatDay(d.date, locale.value)),
    inLanguage: locale.value,
  })
  if (!list) return {}
  return { script: [{ key: 'ld-hub', type: 'application/ld+json', innerHTML: ldJson({ '@context': 'https://schema.org', ...list }) }] }
})
</script>

<template>
  <div class="wrap">
    <header class="bf__head">
      <p class="eyebrow">{{ h.eyebrow }}</p>
      <h1 class="bf__title">{{ h.title }}<span class="bf__dot" aria-hidden="true">.</span></h1>
      <p class="bf__lede">{{ h.lede }}</p>
      <p v-if="day" class="bf__strip">
        <time :datetime="day.date">{{ formatDay(day.date, locale) }}</time>
        <span class="bf__time">{{ h.updated }} <time :datetime="day.generatedAt">{{ formatGenerated(day.generatedAt, locale) }}</time></span>
      </p>
    </header>

    <template v-if="day">
      <section v-if="hub.empty" class="calm">
        <p class="calm__big">{{ h.emptyBig }}</p>
        <p>{{ h.emptyBody(HUB_MIN_DEPTH) }}</p>
      </section>

      <section class="tier" aria-labelledby="bf-errors">
        <h2 id="bf-errors" class="tier__title">{{ h.errorsTitle }} <span v-if="hub.errorsTotal" class="tier__n">{{ hub.errorsTotal }}</span></h2>
        <template v-if="hub.errors.length">
          <p class="tier__note">{{ h.errorsNote }}</p>
          <ol class="tier__items">
            <li v-for="d in hub.errors" :key="d.id"><EvidenceRow :deal="d" :heading-level="3" /></li>
          </ol>
          <p class="tier__more"><NuxtLink :to="lp('/errores')">{{ h.errorsAll(hub.errorsTotal) }} &rarr;</NuxtLink></p>
        </template>
        <p v-else class="tier__none">{{ h.errorsNone }}</p>
      </section>

      <section class="tier tier--deep" aria-labelledby="bf-deep">
        <h2 id="bf-deep" class="tier__title">{{ h.deepTitle }} <span v-if="hub.deepTotal" class="tier__n">{{ hub.deepTotal }}</span></h2>
        <template v-if="hub.deep.length">
          <p class="tier__note">{{ h.deepNote(HUB_MIN_DEPTH) }}</p>
          <ol class="tier__items">
            <li v-for="d in hub.deep" :key="d.id"><EvidenceRow :deal="d" :heading-level="3" :kicker="h.deepKicker" share-on="list" /></li>
          </ol>
          <p v-if="hub.deepTotal > hub.deep.length" class="tier__more">
            {{ h.deepMore(hub.deep.length, hub.deepTotal) }} <NuxtLink :to="lp('/')">{{ h.home }}</NuxtLink>.
          </p>
        </template>
        <p v-else class="tier__none">{{ h.deepNone(HUB_MIN_DEPTH) }}</p>
      </section>

      <nav v-if="hub.categories.length" class="slices" aria-labelledby="bf-cats">
        <h2 id="bf-cats" class="slices__title">{{ h.catsTitle }}</h2>
        <p class="slices__note">{{ h.catsNote }}</p>
        <ul class="slices__list">
          <li v-for="c in hub.categories" :key="c.slug">
            <NuxtLink :to="categoryPath(c.category, locale)!">{{ categoryLabel(c.category, locale) }}</NuxtLink> <span class="slices__n">{{ c.count }}</span>
          </li>
        </ul>
      </nav>
    </template>
    <section v-else class="calm">
      <p class="calm__big">{{ h.failBig }}</p>
      <p>{{ h.failBody }}</p>
    </section>

    <section class="guide" aria-labelledby="bf-guide">
      <h2 id="bf-guide" class="guide__title">{{ h.guideTitle }}</h2>
      <p v-for="(p, i) in h.guide" :key="i">{{ p }}</p>
    </section>
  </div>
</template>

<style scoped>
.bf__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); }
.bf__title { margin: 6px 0 10px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.bf__dot { color: var(--accent-lead); }
.bf__lede { margin: 0 0 clamp(16px, 2vw, 24px); max-width: var(--container-max-prose); font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-primary); }
.bf__strip {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; margin: 0; padding: 7px 0;
  border-top: 2px solid var(--fg-primary); border-bottom: 1px solid var(--fg-primary);
  font-size: 0.8125rem; font-weight: 500; font-variant-numeric: tabular-nums;
}
.bf__strip > :first-child { font-weight: 600; }
.bf__strip > :first-child::first-letter { text-transform: uppercase; }
.bf__time { margin-left: auto; color: var(--fg-secondary); font-weight: 400; }

.tier { padding-top: clamp(20px, 2.5vw, 32px); }
.tier__title { margin: 0; font-size: clamp(1.25rem, 2.2vw, 1.5rem); font-weight: 600; letter-spacing: -0.02em; }
.tier__n { margin-left: 0.25em; font-family: var(--font-mono); font-size: 0.875rem; font-weight: 400; color: var(--fg-secondary); }
.tier__note { margin: 2px 0 10px; max-width: var(--container-max-prose); font-size: 0.8125rem; color: var(--fg-secondary); }
.tier__items { margin: 0; padding: 0; list-style: none; border-bottom: 1px solid var(--border); }
.tier__more { margin: 10px 0 0; font-size: 0.875rem; color: var(--fg-secondary); }
.tier__none { margin: 6px 0 0; max-width: var(--container-max-prose); font-size: 0.9375rem; color: var(--fg-secondary); }
/* Deep cuts are not error candidates: the flag is muted, the evidence rules stay. */
.tier--deep :deep(.er .flag) { color: var(--fg-secondary); }

.calm { padding: clamp(24px, 4vw, 48px) 0 0; max-width: var(--container-max-prose); color: var(--fg-secondary); }
.calm__big { margin: 0 0 8px; font-size: clamp(1.25rem, 2.4vw, 1.75rem); font-weight: 600; letter-spacing: -0.025em; color: var(--fg-primary); }

/* Same look as the category and store lists on the home page. */
.slices { margin-top: clamp(32px, 4vw, 48px); padding-top: 20px; border-top: 1px solid var(--fg-primary); }
.slices__title { margin: 0 0 4px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-secondary); }
.slices__note { margin: 0 0 8px; font-size: 0.8125rem; color: var(--fg-secondary); }
.slices__list { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; }
.slices__list a { color: var(--fg-primary); text-underline-offset: 3px; }
.slices__list a:hover { color: var(--link-fg); }
.slices__n { font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); }

.guide { margin-top: clamp(32px, 4vw, 48px); padding-top: 20px; border-top: 1px solid var(--border); max-width: var(--container-max-prose); }
.guide__title { margin: 0 0 10px; font-size: 1.125rem; font-weight: 600; letter-spacing: -0.015em; }
.guide p { margin: 0 0 12px; font-size: 0.9375rem; line-height: 1.55; color: var(--fg-secondary); }

@media (max-width: 640px) {
  .bf__time { margin-left: 0; flex-basis: 100%; }
}
</style>
