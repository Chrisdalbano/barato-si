<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'
import type { SortDir, SortKey } from '~/utils/filters'
import { defaultDir } from '~/utils/filters'

// The dense view. Sort buttons live in the headers, so they are in the tab order.
// Columns with nothing behind them in this file (brand and interest on old
// archives) are dropped. Narrow containers fold the table; see the styles.
const props = defineProps<{ deals: DealView[]; all: DealView[]; now: number; sort: SortKey; dir: SortDir | null }>()
const emit = defineEmits<{ sort: [key: SortKey] }>()

const hasBrand = computed(() => props.all.some(d => d.brand))
const hasInterest = computed(() => props.all.some(d => d.interest != null))

interface Column { id: string; key: SortKey; label: string; numeric?: boolean; invert?: boolean }
const columns = computed<Column[]>(() => [
  { id: 'product', key: 'producto', label: 'Producto' },
  ...(hasBrand.value ? [{ id: 'brand', key: 'marca' as SortKey, label: 'Marca' }] : []),
  { id: 'store', key: 'tienda', label: 'Tienda' },
  { id: 'price', key: 'precio', label: 'Precio', numeric: true },
  { id: 'ref', key: 'referencia', label: 'Referencia', numeric: true },
  { id: 'depth', key: 'profundidad', label: 'Prof.', numeric: true },
  { id: 'error', key: 'sospecha', label: 'Error', numeric: true },
  ...(hasInterest.value ? [{ id: 'interest', key: 'interes' as SortKey, label: 'Int.', numeric: true }] : []),
  // Sorted by publication time, newest first: as an age column that is ascending.
  { id: 'age', key: 'recientes', label: 'Edad', numeric: true, invert: true },
])
const FULL_LABEL: Record<string, string> = { depth: 'Profundidad contra la referencia', interest: 'Interés' }

function direction(c: Column): SortDir | null {
  if (props.sort !== c.key) return null
  return props.dir ?? defaultDir(c.key)
}
function ariaSort(c: Column): 'ascending' | 'descending' | undefined {
  const d = direction(c)
  if (!d) return undefined
  const asc = c.invert ? d === 'desc' : d === 'asc'
  return asc ? 'ascending' : 'descending'
}
const arrow = (c: Column) => { const s = ariaSort(c); return s === 'ascending' ? '↑' : s === 'descending' ? '↓' : '' }

const digits = (d: DealView) => moneyDigits(d.price, d.reference?.price)
const depth = (d: DealView) => { const v = depthOf(d); return v !== null && v > 0 ? v : null }
const errorClass = (n: number) => (n >= 70 ? 'err--alta' : n >= 40 ? 'err--media' : 'err--baja')
const title = (lines?: string[]) => (lines?.length ? lines.join('\n') : undefined)
</script>

<template>
  <div class="dt">
    <table>
      <caption class="sr-only">Ofertas. Los encabezados ordenan la tabla.</caption>
      <thead>
        <tr>
          <th
            v-for="c in columns" :key="c.id" scope="col" :class="[`c-${c.id}`, { num: c.numeric }]"
            :aria-sort="ariaSort(c)"
          >
            <button type="button" :aria-label="FULL_LABEL[c.id]" @click="emit('sort', c.key)">
              {{ c.label }}<span class="dt__arrow" aria-hidden="true">{{ arrow(c) }}</span>
            </button>
          </th>
          <th scope="col" class="c-go"><span class="sr-only">Enlace</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in deals" :key="d.id">
          <td class="c-product">
            <div class="dt__cell">
              <a class="dt__pic" :href="linkFor(d)" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
                <DealImage :src="d.image" :alt="d.title" mark="" />
              </a>
              <div class="dt__what">
                <a class="dt__title" :href="linkFor(d)" rel="noopener" target="_blank">{{ d.title }}</a>
                <span class="dt__meta">
                  <span class="dt__fold">{{ whoLine(d) }}</span>
                  <span v-if="d.staffPick">elección editorial</span>
                  <span v-if="(d.seenIn?.length ?? 0) >= 2">{{ d.seenIn!.length }} fuentes</span>
                </span>
              </div>
            </div>
          </td>
          <td v-if="hasBrand" class="c-brand">{{ d.brand ?? '' }}</td>
          <td class="c-store">{{ d.store }}</td>
          <td class="c-price num" data-label="Precio">
            <strong>{{ formatPrice(d.price, d.currency, digits(d)) }}</strong>
            <HistoryMark class="dt__hist" :history="d.history" :price="d.price" :currency="d.currency" />
          </td>
          <td class="c-ref num" data-label="Referencia" :title="evidenceLine(d.reference)">
            <template v-if="d.reference">
              <span :class="`ref--${strengthOf(d)}`"><span class="ref__price">{{ formatMoney(d.reference.price, d.currency, digits(d)) }}</span></span>
              <small :class="`evi--${strengthOf(d)}`">{{ EVIDENCE[evidenceOf(d)].short }}</small>
            </template>
            <small v-else class="evi--ninguna">sin referencia</small>
          </td>
          <td class="c-depth num" data-label="Prof." :class="`depth--${strengthOf(d)}`">{{ depth(d) !== null ? formatDiscount(depth(d)!) : '—' }}</td>
          <td class="c-error num" data-label="Error" :class="errorClass(d.errorScore)" :title="title(d.errorSignals)">{{ d.errorScore > 0 ? d.errorScore : '—' }}</td>
          <td v-if="hasInterest" class="c-interest num" data-label="Int." :title="title(d.interestSignals)">{{ d.interest ?? '—' }}</td>
          <td class="c-age num" data-label="Edad"><time :datetime="d.publishedAt">{{ formatAgeShort(d.publishedAt, now) }}</time></td>
          <td class="c-go">
            <a class="dt__go" :href="linkFor(d)" rel="noopener" target="_blank">
              Ver en {{ d.store }}<span class="sr-only"> (abre {{ hostOf(linkFor(d)) }})</span> <span aria-hidden="true">&rarr;</span>
            </a>
            <DealCredit :deal="d" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.dt { container-type: inline-size; container-name: dt; }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8125rem; line-height: 1.3; }
th { position: sticky; top: 0; z-index: 2; background: var(--bg-canvas); box-shadow: inset 0 -1px 0 var(--fg-primary); text-align: left; padding: 0; white-space: nowrap; }
th button { display: block; width: 100%; border: 0; background: none; padding: 8px 8px 7px 0; font: inherit; font-size: 0.75rem; font-weight: 600; color: var(--fg-secondary); cursor: pointer; text-align: inherit; }
th button:hover { color: var(--fg-primary); }
th[aria-sort] button { color: var(--fg-primary); }
th.num, td.num { text-align: right; }
th.num button { padding: 8px 0 7px 8px; }
.dt__arrow { display: inline-block; min-width: 0.75em; margin-left: 2px; color: var(--accent-lead); }
td { padding: 8px 8px 8px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
td.num { padding: 8px 0 8px 8px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; word-spacing: -0.35em; }
tbody tr:hover td { background: var(--bg-surface); }

td.c-product { min-width: 15rem; }
.dt__cell { display: flex; gap: 10px; align-items: flex-start; }
.dt__pic { flex: 0 0 44px; display: block; }
.dt__pic :deep(.frame img) { padding: 2px; }
.dt__what { display: grid; gap: 2px; min-width: 0; }
.dt__title { color: var(--fg-primary); text-decoration: none; font-weight: 500; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.dt__title:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.dt__meta { display: flex; flex-wrap: wrap; gap: 0 0.75em; font-size: 0.6875rem; color: var(--fg-muted); }
.dt__meta:empty { display: none; }
.dt__fold { display: none; color: var(--fg-secondary); }
.c-brand, .c-store { max-width: 8.5rem; overflow-wrap: break-word; }
.c-store { color: var(--fg-secondary); }
.c-price strong { font-weight: 600; font-size: 0.875rem; }
.dt__hist { margin: 4px 0 0 auto; }
.c-ref small { display: block; margin-top: 1px; font-family: var(--font-sans); font-size: 0.6875rem; line-height: 1.2; word-spacing: normal; }
.c-depth { font-size: 0.875rem; }
.err--alta { color: var(--accent-lead); font-weight: 700; }
.err--media { font-weight: 600; }
.err--baja { color: var(--fg-muted); }
.c-interest { color: var(--fg-secondary); }
.c-age { color: var(--fg-muted); }
td.c-go { padding: 8px 0 8px 14px; min-width: 9.5rem; max-width: 11rem; }
th.c-go { width: 1%; }
.dt__go { display: block; overflow-wrap: break-word; font-weight: 600; color: var(--link-fg); text-decoration: none; }
.dt__go:hover { text-decoration: underline; text-underline-offset: 3px; }
.c-go :deep(.credit) { margin-top: 2px; font-size: 0.6875rem; }

/* Mid widths: brand, store and age fold under the title, so no sideways scrolling. */
@container dt (max-width: 900px) {
  .c-brand, .c-store, .c-age { display: none; }
  .dt__fold { display: inline; }
}

/* Phones: each row becomes a small block; the sort control above replaces the headers. */
@container dt (max-width: 620px) {
  thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  table, tbody { display: block; }
  tbody tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  tbody tr:hover td { background: none; }
  td, td.num, td.c-go { display: block; padding: 0; border: 0; text-align: left; min-width: 0; max-width: none; white-space: normal; }
  td.c-age { display: block; }
  td.c-product { grid-column: 1 / -1; min-width: 0; }
  td.c-go { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; }
  td[data-label]::before { content: attr(data-label); display: block; margin-bottom: 1px; font-family: var(--font-sans); font-size: 0.625rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-secondary); }
  .dt__hist { margin-left: 0; }
  .dt__go { display: inline; }
  .c-go :deep(.credit) { margin-top: 0; }
}
</style>
