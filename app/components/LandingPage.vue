<script setup lang="ts">
import { applyFilters, filtersFromQuery } from '~/utils/filters'
import { categoryFromSlug, storeSlug } from '~~/lib/landing'

// One category or one store, today. The same index as the home page (search,
// sort, facets, table or grid), over that slice only, with games and middlemen
// shown: the visitor chose the slice. Prerendered for every slice with deals
// today (nuxt.config.ts, from lib/landing.ts); the sitemap lists the same set.
const props = defineProps<{ kind: 'categoria' | 'tienda' }>()
const { locale, t, lp } = useLang()
const route = useRoute()

const day = await useToday()
const oracle = await useOracle()
provideOracle(oracle)
const landing = provideLanding(() => day.value?.deals)

const slug = computed(() => String(route.params.slug ?? ''))
const category = computed(() => (props.kind === 'categoria' ? categoryFromSlug(slug.value, locale.value) : null))
const storePage = computed(() => (props.kind === 'tienda' ? landing.value.stores.find(s => s.slug === slug.value) ?? null : null))

const deals = computed(() => {
  const all = day.value?.deals ?? []
  if (props.kind === 'categoria') return category.value ? all.filter(d => d.category === category.value) : []
  return all.filter(d => storeSlug(d.store) === slug.value)
})
const name = computed(() => {
  if (props.kind === 'categoria') return category.value ? categoryLabel(category.value, locale.value) : slug.value
  return storePage.value?.name ?? deals.value[0]?.store ?? slug.value
})
const esPath = computed(() => (props.kind === 'categoria'
  ? (category.value ? `/categoria/${category.value}` : `/categoria/${slug.value}`)
  : `/tienda/${slug.value}`))

const w = computed(() => t.value.landing)
useSeo(() => ({
  title: props.kind === 'categoria' ? w.value.seoCatTitle(name.value) : w.value.seoStoreTitle(name.value),
  description: props.kind === 'categoria' ? w.value.seoCatDesc(name.value, deals.value.length) : w.value.seoStoreDesc(name.value, deals.value.length),
  esPath: esPath.value,
  enPath: localePath(esPath.value, 'en'),
  crumbs: [{ name: name.value }],
}))

// Same honesty as the home page's JSON-LD: the first rows of this page's own
// default list, real fields only.
useHead(() => {
  const d = day.value
  const listed = applyFilters(deals.value, filtersFromQuery({}, false, false)).slice(0, 20)
  if (!d || !listed.length) return {}
  const here = siteUrl(locale.value === 'en' ? localePath(esPath.value, 'en') : esPath.value)
  return {
    script: [{
      key: 'ld-landing',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${here}#ofertas`,
        name: w.value.listName(name.value, formatDay(d.date, locale.value)),
        inLanguage: locale.value,
        numberOfItems: listed.length,
        itemListElement: listed.map((deal, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Offer',
            name: deal.title,
            url: linkFor(deal),
            ...(deal.image ? { image: deal.image } : {}),
            price: deal.price.toFixed(2),
            priceCurrency: deal.currency,
            seller: { '@type': 'Organization', name: deal.store },
          },
        })),
      }).replace(/</g, '\\u003c'),
    }],
  }
})

// Internal links to the other slices that exist today.
const otherCats = computed(() => landing.value.categories.filter(c => c.category !== category.value))
const otherStores = computed(() => landing.value.stores.filter(s => s.slug !== slug.value))
</script>

<template>
  <div class="wrap">
    <header class="lp">
      <p class="lp__eyebrow">
        <NuxtLink :to="lp('/')">{{ t.seo.crumbHome }}</NuxtLink>
        <span aria-hidden="true"> / </span>
        <span>{{ kind === 'categoria' ? w.catEyebrow : w.storeEyebrow }}</span>
      </p>
      <h1 class="lp__title">{{ kind === 'categoria' ? w.catTitle(name) : w.storeTitle(name) }}</h1>
      <p v-if="day && deals.length" class="lp__lede">{{ w.lede(deals.length, formatDay(day.date, locale)) }}</p>
    </header>

    <DealExplorer
      v-if="day && deals.length" :key="`${kind}-${slug}`" :deals="deals" :generated-at="day.generatedAt" :title="w.explorer"
    />
    <section v-else class="calm">
      <p class="calm__big">{{ w.empty }}</p>
      <p><NuxtLink :to="lp('/')">{{ w.back }}</NuxtLink></p>
    </section>

    <nav v-if="otherCats.length || otherStores.length" class="more" :aria-label="w.otherCats">
      <div v-if="otherCats.length" class="more__group">
        <h2 class="more__title">{{ w.otherCats }}</h2>
        <ul class="more__list">
          <li v-for="c in otherCats" :key="c.slug">
            <NuxtLink :to="categoryPath(c.category, locale)!">{{ categoryLabel(c.category, locale) }}</NuxtLink> <span class="more__n">{{ c.count }}</span>
          </li>
        </ul>
      </div>
      <div v-if="otherStores.length" class="more__group">
        <h2 class="more__title">{{ w.otherStores }}</h2>
        <ul class="more__list">
          <li v-for="s in otherStores" :key="s.slug">
            <NuxtLink :to="storePath(s.name, locale)!">{{ s.name }}</NuxtLink> <span class="more__n">{{ s.count }}</span>
          </li>
        </ul>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.lp { padding: clamp(16px, 2.5vw, 28px) 0 clamp(14px, 2vw, 20px); }
.lp__eyebrow { margin: 0 0 6px; font-size: 0.8125rem; color: var(--fg-muted); }
.lp__eyebrow a { color: var(--fg-secondary); text-underline-offset: 3px; }
.lp__title { margin: 0; font-size: clamp(2rem, 4.5vw, 3.25rem); line-height: 1; font-weight: 700; letter-spacing: -0.045em; color: var(--fg-primary); overflow-wrap: anywhere; }
.lp__lede { margin: 10px 0 0; max-width: 62ch; font-size: clamp(0.9375rem, 1.3vw, 1.0625rem); line-height: 1.4; color: var(--fg-secondary); }
.calm { padding: clamp(40px, 6vw, 80px) 0; border-top: 2px solid var(--fg-primary); max-width: var(--container-max-prose); color: var(--fg-secondary); }
.calm__big { margin: 0 0 12px; font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 600; letter-spacing: -0.03em; color: var(--fg-primary); }
.more { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 24px 48px; margin-top: clamp(32px, 4vw, 48px); padding-top: 20px; border-top: 1px solid var(--fg-primary); }
.more__title { margin: 0 0 8px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-secondary); }
.more__list { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; }
.more__list a { color: var(--fg-primary); text-underline-offset: 3px; }
.more__list a:hover { color: var(--link-fg); }
.more__n { font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); }
</style>
