<script setup lang="ts">
const route = useRoute()
const { locale, t, lp } = useLang()
const cfg = useRuntimeConfig().public

const nav = computed(() => [
  { to: lp('/'), label: t.value.nav.today },
  { to: lp('/errores'), label: t.value.nav.errors },
  { to: lp('/si'), label: t.value.nav.si },
  { to: lp('/archivo'), label: t.value.nav.archive },
  { to: lp('/api'), label: t.value.nav.api },
])
const here = computed(() => route.path.replace(/\/+$/, '') || '/')
const other = computed(() => localePath(here.value, locale.value === 'es' ? 'en' : 'es'))

// Monetization switches, each off unless configured at build time.
const adsClient = computed(() => String(cfg.adsenseClient ?? ''))
const adsOn = computed(() => /^ca-pub-\d+$/.test(adsClient.value))
const affiliateOn = computed(() => !!String(cfg.amazonTag ?? '').trim())
const supportUrl = computed(() => /^https:\/\//.test(String(cfg.supportUrl ?? '')) ? String(cfg.supportUrl) : '')
const sponsorUrl = computed(() => /^https:\/\//.test(String(cfg.sponsorUrl ?? '')) ? String(cfg.sponsorUrl) : '')

useHead(() => ({
  htmlAttrs: { lang: locale.value },
  script: adsOn.value
    ? [{ key: 'adsense', src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsClient.value}`, async: true, crossorigin: 'anonymous' }]
    : [],
}))
</script>

<template>
  <div class="site">
    <a class="skip" href="#contenido">{{ t.skip }}</a>
    <header class="top">
      <div class="wrap top__inner">
        <div class="top__brand">
          <NuxtLink :to="lp('/')" class="brand" :aria-label="t.brandAria">
            <span class="brand__name">barato<span class="brand__dot">.</span>si</span>
            <span class="brand__tag">{{ t.brandTag }}</span>
          </NuxtLink>
          <LangCallout />
        </div>
        <nav class="top__nav" :aria-label="t.navAria">
          <NuxtLink
            v-for="n in nav" :key="n.to" :to="n.to" class="top__link"
            :aria-current="here === n.to ? 'page' : undefined"
          >{{ n.label }}</NuxtLink>
          <a href="/feed.xml" class="top__link">{{ t.nav.rss }}</a>
          <!-- A plain link on purpose: /en is an alias of the same page, and the router
               would treat a client-side push to it as a duplicate and stay put. -->
          <a :href="other" class="top__link top__lang" :hreflang="t.switchTo.hreflang" :lang="t.switchTo.hreflang" :title="t.switchTo.title">{{ t.switchTo.label }}</a>
        </nav>
      </div>
    </header>

    <main id="contenido">
      <NuxtPage />
    </main>

    <div class="wrap"><AdSlot slot="footer" /></div>

    <footer class="foot">
      <div class="wrap foot__inner">
        <p class="foot__sign">barato, sí<span class="foot__dot" aria-hidden="true">.</span></p>
        <div class="foot__text">
          <p class="foot__legal">{{ t.footer.legal }}</p>
          <p v-if="affiliateOn" class="foot__legal">{{ t.footer.affiliate }}</p>
        </div>
        <div class="foot__side">
          <p class="foot__links">
            <a href="/api/deals.json">deals.json</a>
            <a href="/feed.xml">RSS</a>
            <a href="/errors.xml">{{ t.footer.errorsRss }}</a>
            <a href="/llms.txt">llms.txt</a>
            <NuxtLink :to="lp('/privacidad')">{{ t.footer.privacy }}</NuxtLink>
          </p>
          <p v-if="supportUrl || sponsorUrl" class="foot__links">
            <a v-if="supportUrl" :href="supportUrl" rel="noopener" target="_blank">{{ t.footer.support }}</a>
            <a v-if="sponsorUrl" :href="sponsorUrl" rel="noopener" target="_blank">{{ t.footer.sponsor }}</a>
          </p>
          <p class="foot__made">
            <span>{{ t.footer.madeBy }} <a href="https://chrisdalbano.com" rel="noopener">Chris D'Albano</a>.</span>
            <span class="foot__org">
              {{ t.footer.project }}
              <a href="https://formship.io" rel="noopener" class="foot__formship"><FormshipMark :size="13" /> Formship LLC</a>.
            </span>
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site { display: flex; flex-direction: column; min-height: 100dvh; }
/* At least a screen tall, so the footer always starts below the fold and a page whose
   content arrives after navigation never drags a visible footer down. */
main { flex: 1; min-height: 100dvh; }
.skip { position: absolute; left: -9999px; top: 0; padding: 8px 12px; background: var(--fg-primary); color: var(--bg-canvas); z-index: 40; }
.skip:focus { left: 8px; top: 8px; }

/* The header is the same height on every page and in both languages: one row on
   desktop, a fixed two-row layout on phones. Nothing in it changes width when a
   tab becomes active (colour and rule only, never weight). */
.top { border-bottom: 1px solid var(--fg-primary); }
.top__inner { display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; min-height: 48px; }
.top__brand { position: relative; display: flex; align-items: center; min-width: 0; align-self: stretch; }
.brand { display: flex; align-items: baseline; gap: 12px; color: var(--fg-primary); text-decoration: none; }
.brand__name { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.04em; }
.brand__dot { color: var(--accent-lead); }
.brand__tag { font-size: 0.8125rem; color: var(--fg-muted); white-space: nowrap; }
.top__nav { display: flex; align-items: center; gap: clamp(12px, 2.2vw, 26px); }
.top__link { font-size: 0.875rem; font-weight: 500; color: var(--fg-primary); text-decoration: none; padding: 4px 0; border-bottom: 1px solid transparent; white-space: nowrap; }
.top__link:hover { border-bottom-color: var(--fg-primary); }
.top__link[aria-current="page"] { color: var(--accent-lead); border-bottom-color: var(--accent-lead); }
.top__lang { font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.04em; color: var(--fg-secondary); padding-left: clamp(12px, 2vw, 20px); border-left: 1px solid var(--border-strong); border-bottom: 0; }
.top__lang:hover { color: var(--link-fg); border-bottom: 0; }

.foot { margin-top: clamp(40px, 5vw, 64px); border-top: 1px solid var(--fg-primary); }
.foot__inner { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 22rem); gap: 16px 48px; padding-top: 24px; padding-bottom: 40px; font-size: 0.8125rem; color: var(--fg-secondary); }
.foot p { margin: 0; }
.foot__sign { grid-column: 1 / -1; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; letter-spacing: -0.05em; line-height: 1; color: var(--fg-primary); }
.foot__dot { color: var(--accent-lead); }
.foot__text { display: grid; gap: 10px; align-content: start; }
.foot__legal { max-width: 62ch; }
.foot__side { display: grid; gap: 10px; align-content: start; }
.foot__links { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.foot__made { display: grid; gap: 4px; color: var(--fg-muted); }
.foot a { color: var(--fg-primary); text-underline-offset: 3px; }
.foot a:hover { color: var(--link-fg); }
.foot__org .foot__formship { color: var(--fg-secondary); text-decoration: none; white-space: nowrap; }
.foot__org .foot__formship:hover { color: var(--link-fg); text-decoration: underline; }

@media (max-width: 900px) { .brand__tag { display: none; } }
@media (max-width: 640px) {
  .top__inner { flex-wrap: wrap; padding-top: 6px; padding-bottom: 0; min-height: 0; }
  .top__brand { min-height: 32px; }
  /* Second row: the sections, scrolling sideways if they ever outgrow a phone. */
  .top__nav { flex: 1 1 100%; overflow-x: auto; scrollbar-width: none; gap: 18px; padding-bottom: 2px; }
  .top__nav::-webkit-scrollbar { display: none; }
  .top__link { padding: 8px 0; }
  .top__lang { margin-left: auto; }
  .foot__inner { grid-template-columns: 1fr; }
}
</style>
