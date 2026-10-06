<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// The price-error section above the ranked list: a 2-3 column grid of error
// cards with their evidence. `suspects` marks the fallback set (no 70+ today,
// so the top candidates at 55+), which is labelled as such, never as errors.
// The parent renders this only when there is at least one card.
withDefaults(defineProps<{
  deals: DealView[]
  total?: number
  suspects?: boolean
  level?: 2 | 3
  more?: boolean
}>(), { total: 0, suspects: false, level: 2, more: true })
</script>

<template>
  <section id="errores" class="errs" aria-labelledby="errs-title">
    <div class="errs__head">
      <component :is="level === 3 ? 'h3' : 'h2'" id="errs-title" class="errs__title">
        {{ suspects ? 'Sospechosas' : 'Posibles errores de precio' }}
      </component>
      <p class="errs__count">{{ Math.max(total, deals.length) }}</p>
    </div>
    <p class="errs__note">
      <template v-if="suspects">
        Hoy nada llega a posible error de precio. Estas son las rebajas que más se le parecen, con las señales que encontramos.
      </template>
      <template v-else>
        Rebajas tan hondas que parecen un fallo de la tienda. Es una suposición automática de barato.si:
        la tienda puede corregirlo o no respetarlo.
      </template>
    </p>
    <div class="errs__grid">
      <ol class="errs__items">
        <li v-for="d in deals" :key="d.id" class="errs__cell">
          <ErrorCard :deal="d" />
        </li>
      </ol>
    </div>
    <p v-if="more" class="errs__more">
      <NuxtLink to="/errores">Todos los sospechosos <span aria-hidden="true">&rarr;</span></NuxtLink>
    </p>
  </section>
</template>

<style scoped>
.errs { padding: clamp(28px, 4vw, 48px) 0 clamp(16px, 2vw, 24px); border-top: 2px solid var(--accent-lead); }
.errs__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.errs__title { margin: 0; font-size: clamp(1.5rem, 3vw, 2.25rem); letter-spacing: -0.03em; font-weight: 600; color: var(--accent-lead); }
.errs__count { margin: 0; font-family: var(--font-mono); font-size: 0.875rem; color: var(--accent-lead); font-variant-numeric: tabular-nums; }
.errs__note { margin: 10px 0 22px; max-width: var(--container-max-prose); font-size: 0.9375rem; color: var(--fg-secondary); }
/* Same ruled-cell trick as the deal grid, at 2-3 columns. */
.errs__grid { overflow: hidden; border-bottom: 1px solid var(--border); }
.errs__items {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  margin: 0 0 0 -1px; padding: 0; list-style: none;
}
.errs__cell { border-top: 1px solid var(--border); border-left: 1px solid var(--border); min-width: 0; }
.errs__more { margin: 18px 0 0; }
.errs__more a { font-weight: 600; text-decoration: none; }
.errs__more a:hover { text-decoration: underline; text-underline-offset: 3px; }
</style>
