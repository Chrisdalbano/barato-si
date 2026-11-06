<script setup lang="ts">
import { landingPages } from '~~/lib/landing'
import { PAGES } from '~/utils/locale'

// The advertise page: what the one sponsored line is, how it is reviewed and
// refunded, the Stripe link, and only facts the index can show about itself,
// read from today's deals.json (the same file every page is built from). No
// traffic or audience numbers, by design: we do not have ones worth selling.
definePageMeta({ alias: ['/en/advertise'] })

const { locale, t, lp } = useLang()
usePageSeo('anunciate', { es: 'Anúnciate', en: 'Advertise' })

const cfg = useRuntimeConfig().public
const payUrl = computed(() => (/^https:\/\//.test(String(cfg.sponsorUrl ?? '')) ? String(cfg.sponsorUrl) : ''))
const sponsor = useSponsor()
const booked = useBookedSponsor()

const day = await useToday()
const facts = computed(() => {
  const d = day.value
  if (!d) return null
  const set = landingPages(d.deals)
  const landing = set.categories.length + set.stores.length
  return {
    deals: d.deals.length,
    sources: d.sources.filter(s => s.ok).length,
    landing,
    pages: PAGES.length + landing,
    generatedAt: d.generatedAt,
  }
})
const a = computed(() => t.value.advertise)
</script>

<template>
  <div class="wrap ad">
    <header class="ad__head">
      <p class="eyebrow">{{ a.eyebrow }}</p>
      <h1 class="ad__title">{{ a.title }}<span class="ad__dot" aria-hidden="true">.</span></h1>
      <p class="ad__lede">{{ a.lede }}</p>
    </header>

    <section v-for="s in a.sections" :key="s.h" class="ad__sec prose">
      <h2>{{ s.h }}</h2>
      <p v-for="p in s.p" :key="p">{{ p }}</p>
    </section>

    <section v-if="facts" class="ad__sec ad__facts" aria-labelledby="ad-facts">
      <h2 id="ad-facts">{{ a.factsTitle }}</h2>
      <div>
        <dl class="facts">
          <div><dt>{{ a.deals }}</dt><dd>{{ formatNumber(facts.deals, locale) }}</dd></div>
          <div><dt>{{ a.sources }}</dt><dd>{{ formatNumber(facts.sources, locale) }}</dd></div>
          <div><dt>{{ a.pages }}</dt><dd>{{ formatNumber(facts.pages, locale) }}</dd></div>
          <div><dt>{{ a.landing }}</dt><dd>{{ formatNumber(facts.landing, locale) }}</dd></div>
          <div><dt>{{ a.refresh }}</dt><dd class="facts__text">{{ a.every3h }}</dd></div>
          <div><dt>{{ a.updated }}</dt><dd class="facts__text"><time :datetime="facts.generatedAt">{{ formatGenerated(facts.generatedAt, locale) }}</time></dd></div>
        </dl>
        <p class="ad__note">
          {{ a.factsNote }}
          {{ a.feeds }} <a href="/feed.xml">RSS</a>, <a href="/api/deals.json">JSON</a>, <a href="/llms.txt">llms.txt</a>.
        </p>
      </div>
    </section>

    <section class="ad__sec ad__pay" aria-labelledby="ad-pay">
      <h2 id="ad-pay">{{ a.payTitle }}</h2>
      <div>
        <p v-if="sponsor" class="ad__busy">{{ a.busy(formatDayMonth(sponsor.until, locale)) }}</p>
        <template v-else-if="payUrl">
          <p v-if="booked" class="ad__busy ad__booked">{{ a.booked(formatDayMonth(booked.from, locale), formatDayMonth(booked.until, locale)) }}</p>
          <p><a class="ad__btn" :href="payUrl" rel="noopener" target="_blank">{{ a.pay }}</a></p>
          <p class="ad__note">{{ a.payNote }}</p>
        </template>
        <p v-else class="ad__busy">{{ a.closed }}</p>
        <p class="ad__note">{{ a.who }} <NuxtLink :to="lp('/privacidad')">{{ t.footer.privacy }}</NuxtLink>.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ad__head { padding: clamp(20px, 3vw, 36px) 0 clamp(16px, 2vw, 24px); }
.ad__title { margin: 6px 0 10px; font-size: clamp(2rem, 4.5vw, 3.5rem); line-height: 1; font-weight: 600; letter-spacing: -0.045em; }
.ad__dot { color: var(--accent-lead); }
.ad__lede { margin: 0; max-width: var(--container-max-prose); font-size: clamp(1rem, 1.4vw, 1.125rem); color: var(--fg-secondary); }
.ad__sec { display: grid; grid-template-columns: minmax(0, 14rem) minmax(0, 1fr); gap: 4px 32px; max-width: none; padding: 14px 0; border-top: 1px solid var(--border); }
.ad__sec:first-of-type { border-top: 2px solid var(--fg-primary); }
.ad__sec h2 { margin: 0; font-size: 1rem; font-weight: 600; }
.ad__sec > p { grid-column: 2; max-width: var(--container-max-prose); margin: 0; color: var(--fg-secondary); }
.ad__sec > div { grid-column: 2; min-width: 0; }
.facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 12px 24px; margin: 0; }
.facts div { border-top: 1px solid var(--border); padding-top: 6px; }
.facts dt { font-size: 0.75rem; color: var(--fg-muted); }
.facts dd { margin: 2px 0 0; font-family: var(--font-mono); font-size: 1.25rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fg-primary); }
.facts dd.facts__text { font-family: var(--font-sans); font-size: 0.9375rem; font-weight: 500; }
.ad__note { margin: 10px 0 0; max-width: var(--container-max-prose); font-size: 0.8125rem; color: var(--fg-muted); }
.ad__note a { color: var(--fg-primary); text-underline-offset: 3px; }
.ad__busy { margin: 0; color: var(--fg-primary); }
.ad__pay p { margin: 0; }
.ad__pay p.ad__booked { margin-bottom: 10px; }
.ad__btn { display: inline-block; margin: 2px 0 0; padding: 10px 16px; background: var(--accent-lead); color: var(--bg-canvas); font-weight: 600; text-decoration: none; border-radius: 2px; }
.ad__btn:hover { background: var(--fg-primary); }
.ad__btn:focus-visible { outline: 2px solid var(--fg-primary); outline-offset: 2px; }
@media (max-width: 640px) {
  .ad__sec { grid-template-columns: 1fr; }
  .ad__sec > p, .ad__sec > div { grid-column: 1; }
}
</style>
