<script setup lang="ts">
import { animate } from 'motion-v'

const props = defineProps<{
  price: number
  listPrice: number | null
  currency: string
  discountPct: number | null
  lead?: boolean
  /** No count-down: grid cards and error cards render the final price at once. */
  still?: boolean
}>()

const free = computed(() => props.price <= 0)
const hasList = computed(() => hasListPrice(props.price, props.listPrice))
const digits = computed(() => moneyDigits(props.price, hasList.value ? props.listPrice : null))
const off = computed(() => (props.discountPct !== null && Number.isFinite(props.discountPct) && props.discountPct > 0 ? props.discountPct : null))

// The server renders the final price. On the client, a deal that has not been
// seen yet is "armed" at its list price; when it scrolls into view the price
// counts down to the sale price and the strike line draws across the list price.
// A free deal does not count down to "0,00": it shows "Gratis" and only the strike draws.
const shown = ref(props.price)
const armed = ref(false)
const root = ref<HTMLElement | null>(null)
let stop: (() => void) | undefined
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (props.still || !hasList.value || !root.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const from = props.listPrice as number
  armed.value = true
  if (!free.value) shown.value = from
  observer = new IntersectionObserver((entries) => {
    if (!entries.some(e => e.isIntersecting)) return
    observer?.disconnect()
    armed.value = false
    if (free.value) { shown.value = props.price; return }
    const controls = animate(from, props.price, {
      duration: props.lead ? 1.1 : 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v: number) => { shown.value = v },
      onComplete: () => { shown.value = props.price },
    })
    stop = () => controls.stop()
  }, { threshold: 0.6 })
  observer.observe(root.value)
})

// A client refresh can hand a different price to the same component.
watch(() => [props.price, props.listPrice], () => {
  stop?.(); observer?.disconnect(); armed.value = false; shown.value = props.price
})
onBeforeUnmount(() => { stop?.(); observer?.disconnect() })
</script>

<template>
  <div ref="root" class="price" :class="{ 'price--lead': lead, 'price--free': free, 'is-armed': armed }">
    <span class="price__now">
      <span class="sr-only">Precio: </span>{{ formatPrice(shown, currency, digits) }}
    </span>
    <span v-if="hasList" class="price__was">
      <span class="sr-only">Antes: </span><s>{{ formatMoney(listPrice!, currency, digits) }}</s>
    </span>
    <span v-if="off !== null" class="price__off">{{ formatDiscount(off) }}</span>
  </div>
</template>

<style scoped>
.price { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: flex-end; gap: 0.15em 0.75em; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.price__now { font-size: 1.375rem; font-weight: 600; letter-spacing: -0.02em; color: var(--fg-primary); white-space: nowrap; }
.price__was { font-size: 0.875rem; color: var(--fg-muted); white-space: nowrap; }
.price--free .price__now { color: var(--accent-lead); }
.price__off { font-size: 0.875rem; font-weight: 600; color: var(--accent-lead); white-space: nowrap; }

/* The strike is a drawn line, not text-decoration, so it can animate. */
.price__was s { position: relative; text-decoration: none; }
.price__was s::after {
  content: ''; position: absolute; left: -2px; right: -2px; top: 52%; height: 1.5px;
  background: currentColor; transform-origin: left center;
  transition: transform 520ms cubic-bezier(0.65, 0, 0.35, 1) 180ms;
}
.is-armed .price__was s::after { transform: scaleX(0); transition: none; }

.price--lead { justify-content: flex-start; gap: 0.25em 1em; }
.price--lead .price__now { flex-basis: 100%; font-family: var(--font-sans);font-size: clamp(3.5rem, 11vw, 8.5rem); line-height: 0.92; letter-spacing: -0.045em; font-weight: 600; }
.price--lead .price__was { font-size: clamp(1.125rem, 2.2vw, 1.5rem); }
.price--lead .price__was s::after { height: 2px; }
.price--lead .price--free .price__now { color: var(--accent-lead); }
.price__off { font-size: clamp(1.125rem, 2.2vw, 1.5rem); }

@media (prefers-reduced-motion: reduce) {
  .price__was s::after { transition: none; }
}
</style>
