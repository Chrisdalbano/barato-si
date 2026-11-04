<script setup lang="ts">
import type { PromoItem } from '~/utils/extras'

// One row of the home page's picks: a horizontal scroll-snap track with
// previous/next buttons. No autoplay. The track is focusable, so arrow keys
// scroll it natively; the buttons move it by about a screen. Every card has a
// fixed frame, so the row's height is known from the first paint.

const props = defineProps<{ id: string; title: string; note?: string; items: PromoItem[] }>()
const { t } = useLang()
const out = useOutbound()

const track = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(false)
function update() {
  const el = track.value
  if (!el) return
  atStart.value = el.scrollLeft <= 2
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
}
function move(dir: 1 | -1) {
  const el = track.value
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.85), behavior: reduce ? 'auto' : 'smooth' })
}
onMounted(() => {
  update()
  window.addEventListener('resize', update, { passive: true })
})
onUnmounted(() => window.removeEventListener('resize', update))
const headId = computed(() => `promo-${props.id}`)
</script>

<template>
  <section class="pc" :aria-labelledby="headId" aria-roledescription="carousel">
    <div class="pc__head">
      <div class="pc__titles">
        <h3 :id="headId" class="pc__title">{{ title }}</h3>
        <p v-if="note" class="pc__note">{{ note }}</p>
      </div>
      <div class="pc__nav">
        <button type="button" class="seg" :disabled="atStart" :aria-label="t.promos.prev" @click="move(-1)"><span aria-hidden="true">&larr;</span></button>
        <button type="button" class="seg" :disabled="atEnd" :aria-label="t.promos.next" @click="move(1)"><span aria-hidden="true">&rarr;</span></button>
      </div>
    </div>
    <ul ref="track" class="pc__track" tabindex="0" :aria-label="t.promos.region(title)" @scroll.passive="update">
      <li v-for="item in items" :key="item.kind === 'deal' ? item.deal.id : item.id" class="pc__item" :class="`pc__item--${item.kind}`">
        <article v-if="item.kind === 'deal'" class="pcard">
          <a class="pcard__pic" :href="out.href(item.deal)" :rel="out.rel(item.deal)" target="_blank" tabindex="-1" aria-hidden="true">
            <DealImage :src="item.deal.image" :fallback="item.deal.imageFallback" :alt="item.deal.title" :mark="storeMark(item.deal)" />
          </a>
          <p class="pcard__who">{{ whoLine(item.deal) }}</p>
          <h4 class="pcard__title"><a :href="out.href(item.deal)" :rel="out.rel(item.deal)" target="_blank">{{ item.deal.title }}</a></h4>
          <PromoPrice :deal="item.deal" />
          <p class="pcard__oracle"><OracleBadge :deal-id="item.deal.id" /></p>
        </article>
        <LoreCard v-else :n="item.n" :text="item.text" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pc { padding: 18px 0 4px; border-top: 1px solid var(--border); }
.pc__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 24px; margin-bottom: 10px; }
.pc__titles { min-width: 0; }
.pc__title { margin: 0; font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.015em; }
.pc__note { margin: 2px 0 0; max-width: var(--container-max-prose); font-size: 0.8125rem; color: var(--fg-secondary); }
.pc__nav { display: flex; flex: none; }
.pc__nav .seg { height: 32px; width: 40px; padding: 0; font-size: 0.9375rem; }
.pc__nav .seg:disabled { color: var(--fg-muted); border-color: var(--border); cursor: default; background: none; }

.pc__track {
  display: grid; grid-auto-flow: column; grid-auto-columns: 13.5rem; gap: 0;
  margin: 0; padding: 0 0 10px; list-style: none;
  overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-padding-left: 0;
  scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent;
}
.pc__track:focus-visible { outline-offset: 4px; }
.pc__item { scroll-snap-align: start; min-width: 0; border-left: 1px solid var(--border); padding: 0 14px; }
.pc__item:first-child { border-left: 0; padding-left: 0; }

.pcard { display: grid; grid-template-rows: auto auto auto auto 1.2rem; gap: 5px; height: 100%; align-content: start; }
.pcard__pic { display: block; text-decoration: none; }
.pcard p { margin: 0; }
.pcard__who { font-size: 0.6875rem; color: var(--fg-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcard__title {
  margin: 0; font-size: 0.8125rem; line-height: 1.3; font-weight: 500; min-height: 2.6em; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
}
.pcard__title a { color: var(--fg-primary); text-decoration: none; }
.pcard__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }

@media (max-width: 540px) {
  .pc__track { grid-auto-columns: 11rem; }
  .pc__item { padding: 0 10px; }
}
@media (prefers-reduced-motion: reduce) { .pc__track { scroll-behavior: auto; } }
</style>
