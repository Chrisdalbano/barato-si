<script setup lang="ts">
import type { ActiveItem, QueryPatch } from '~/utils/filters'

// The narrowings in force, as plain removable text above the results.
defineProps<{ items: ActiveItem[] }>()
const emit = defineEmits<{ remove: [patch: QueryPatch]; clear: [] }>()
const { t } = useLang()
</script>

<template>
  <div v-if="items.length" class="af">
    <h3 class="sr-only">{{ t.active.heading }}</h3>
    <ul>
      <li v-for="item in items" :key="item.id">
        <button type="button" @click="emit('remove', item.patch)">
          <span>{{ item.label }}</span>
          <span class="af__x" aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t.active.remove }}</span>
        </button>
      </li>
    </ul>
    <button type="button" class="af__clear" @click="emit('clear')">{{ t.active.clear }}</button>
  </div>
</template>

<style scoped>
.af { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 18px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.8125rem; }
.af ul { display: contents; list-style: none; }
.af li { display: inline; }
.af button { border: 0; background: none; padding: 2px 0; font: inherit; color: var(--fg-primary); cursor: pointer; text-align: left; }
.af li button { text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 3px; overflow-wrap: anywhere; }
.af li button:hover { text-decoration-color: currentColor; color: var(--link-fg); }
.af__x { margin-left: 0.35em; color: var(--fg-muted); }
.af__clear { font-weight: 600 !important; color: var(--link-fg) !important; }
.af__clear:hover { text-decoration: underline; text-underline-offset: 3px; }
</style>
