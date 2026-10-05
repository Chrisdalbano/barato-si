<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'

// Probable pricing mistakes get their own short section above the ranked
// list. The parent renders this only when there is at least one.
defineProps<{ deals: DealView[]; ranks: Map<string, number>; now: number; level?: 2 | 3 }>()
</script>

<template>
  <section id="errores" class="errs" aria-labelledby="errs-title">
    <div class="errs__head">
      <component :is="level === 3 ? 'h3' : 'h2'" id="errs-title" class="errs__title">Posibles errores de precio</component>
      <p class="errs__count">{{ deals.length }}</p>
    </div>
    <p class="errs__note">
      Rebajas tan hondas que parecen un fallo de la tienda. Es una suposición automática de barato.si:
      la tienda puede corregirlo o no respetarlo.
    </p>
    <ol class="errs__items">
      <li v-for="d in deals" :key="d.id">
        <DealRow :deal="d" :rank="ranks.get(d.id) ?? 0" :now="now" hide-flag />
      </li>
    </ol>
  </section>
</template>

<style scoped>
.errs { padding: clamp(28px, 4vw, 48px) 0 clamp(16px, 2vw, 24px); border-top: 2px solid var(--accent-lead); }
.errs__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.errs__title { margin: 0; font-size: clamp(1.5rem, 3vw, 2.25rem); letter-spacing: -0.03em; font-weight: 600; color: var(--accent-lead); }
.errs__count { margin: 0; font-family: var(--font-mono); font-size: 0.875rem; color: var(--accent-lead); font-variant-numeric: tabular-nums; }
.errs__note { margin: 10px 0 18px; max-width: var(--container-max-prose); font-size: 0.9375rem; color: var(--fg-secondary); }
.errs__items { margin: 0; padding: 0; list-style: none; }
</style>
