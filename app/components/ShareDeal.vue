<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// A quiet "Compartir" on each deal. On phones and tablets (coarse pointer) it opens
// the system share sheet, where WhatsApp already is. Elsewhere, and when the
// sheet is missing or fails, a small menu: WhatsApp first (the Spanish-speaking
// audience lives there), Telegram, X, copy link. The shared URL is a barato.si
// page with this deal's row on it (shareTarget), never the merchant. The only
// extra is ?ref=share, which no page reads. Nothing here runs before a click,
// so server and client render the same button.
const props = defineProps<{ deal: DealView; on?: 'errors' | 'list' }>()
const { locale, t } = useLang()
const { live } = useLandingLinks()
const show = computed(() => props.on === 'errors' || live)

const open = ref(false)
const copied = ref(false)
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const menuId = useId()
// Fixed to the viewport, placed under the button: carousel tracks scroll sideways
// and would clip anything absolutely positioned inside them.
const pos = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const MENU_W = 176
function place() {
  const r = button.value?.getBoundingClientRect()
  if (!r) return
  const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8))
  const below = r.bottom + 4
  const top = below + 170 > window.innerHeight ? Math.max(8, r.top - 4 - 170) : below
  pos.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

const url = computed(() => shareTarget(props.deal, locale.value, props.on ?? 'list'))
const text = computed(() => t.value.share.text(
  props.deal.title,
  formatPrice(props.deal.price, props.deal.currency, moneyDigits(props.deal.price), locale.value),
  props.deal.store,
))
const links = computed(() => {
  const u = encodeURIComponent(url.value)
  const msg = encodeURIComponent(text.value)
  return [
    { id: 'whatsapp', label: t.value.share.whatsapp, href: `https://wa.me/?text=${encodeURIComponent(`${text.value} ${url.value}`)}` },
    { id: 'telegram', label: t.value.share.telegram, href: `https://t.me/share/url?url=${u}&text=${msg}` },
    { id: 'x', label: t.value.share.x, href: `https://x.com/intent/post?text=${msg}&url=${u}` },
  ]
})

async function onClick() {
  if (open.value) { close(); return }
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
  if (typeof nav.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    try { await nav.share({ title: props.deal.title, text: text.value, url: url.value }); return } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return // the reader closed the sheet
    }
  }
  place()
  open.value = true
}
function close(refocus = false) {
  open.value = false
  copied.value = false
  if (refocus) button.value?.focus()
}
async function copy() {
  try { await navigator.clipboard.writeText(url.value); copied.value = true } catch {
    window.prompt(t.value.share.copy, url.value)
  }
}
function onDocClick(e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) close() }
function onKey(e: KeyboardEvent) { if (open.value && e.key === 'Escape') close(true) }
function onMove() { if (open.value) close() }
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onMove, { passive: true, capture: true })
  window.addEventListener('resize', onMove, { passive: true })
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onMove, { capture: true })
  window.removeEventListener('resize', onMove)
})
</script>

<template>
  <span v-if="show" ref="root" class="sh">
    <button
      ref="button" type="button" class="sh__btn" :aria-expanded="open" :aria-controls="menuId"
      :aria-label="t.share.menu(deal.title)" @click="onClick"
    >
      <svg class="sh__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5v8M4.75 4.75 8 1.5l3.25 3.25M3 8.5V14h10V8.5" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
      <span>{{ t.share.label }}</span>
    </button>
    <span v-show="open" :id="menuId" class="sh__menu" :style="pos" role="group" :aria-label="t.share.menu(deal.title)">
      <a v-for="l in links" :key="l.id" :class="`sh__item sh__item--${l.id}`" :href="l.href" target="_blank" rel="noopener" @click="close()">{{ l.label }}</a>
      <button type="button" class="sh__item" @click="copy">{{ copied ? t.share.copied : t.share.copy }}</button>
      <span class="sr-only" aria-live="polite">{{ copied ? t.share.copied : '' }}</span>
    </span>
  </span>
</template>

<style scoped>
.sh { position: relative; display: inline-flex; }
.sh__btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 0; border: 0; background: none;
  font: inherit; font-size: 0.75rem; color: var(--fg-secondary); cursor: pointer;
}
.sh__btn:hover, .sh__btn[aria-expanded="true"] { color: var(--fg-primary); text-decoration: underline; text-underline-offset: 3px; }
.sh__icon { width: 12px; height: 12px; }
/* Out of the flow: opening it never moves anything. */
.sh__menu {
  position: fixed; z-index: 40; display: grid; width: 176px;
  background: var(--bg-canvas); border: 1px solid var(--fg-primary); box-shadow: 4px 4px 0 var(--border);
}
.sh__item {
  display: block; padding: 7px 12px; border: 0; border-top: 1px solid var(--border); background: none;
  font: inherit; font-size: 0.8125rem; text-align: left; color: var(--fg-primary); text-decoration: none; cursor: pointer; white-space: nowrap;
}
.sh__item:first-child { border-top: 0; }
.sh__item:hover { background: var(--bg-surface); }
.sh__item--whatsapp { font-weight: 600; }
</style>
