<script setup lang="ts">
import type { DealView } from '~/composables/useDeals'
import type { HighlightsFile, PromoItem } from '~/utils/extras'

// The pipeline's picks for today (highlights.json), one carousel per slot, with
// a few Don Centavo rules between the cards. A slot whose deals are not in
// today's file is skipped; with no slots at all, nothing renders.
const props = defineProps<{ highlights: HighlightsFile | null | undefined; deals: DealView[]; date: string }>()
const { locale, t } = useLang()

const byId = computed(() => new Map(props.deals.map(d => [d.id, d])))
// The rule shown in each row turns with the date, the same on server and client.
const dayIndex = computed(() => Math.floor((Date.parse(`${props.date}T12:00:00Z`) || 0) / 86400000))

const rows = computed(() => {
  const rules = t.value.lore.rules
  const slots = props.highlights?.slots ?? []
  const out: { id: string; title: string; note: string; items: PromoItem[] }[] = []
  slots.forEach((slot) => {
    const deals = slot.dealIds.map(id => byId.value.get(id)).filter((d): d is DealView => !!d)
    if (!deals.length) return
    const items: PromoItem[] = deals.map(deal => ({ kind: 'deal', deal }))
    // A rule after the third card, only in rows long enough to keep going past it.
    if (deals.length > 3) {
      const r = Math.abs(dayIndex.value + out.length * 3) % rules.length
      items.splice(3, 0, { kind: 'lore', id: `${slot.id}-rule`, n: r + 1, text: rules[r]! })
    }
    if (!out.length) items.push({ kind: 'lore', id: `${slot.id}-intro`, text: t.value.lore.intro })
    out.push({
      id: slot.id,
      title: locale.value === 'en' ? slot.titleEn : slot.titleEs,
      note: locale.value === 'en' ? slot.noteEn : slot.noteEs,
      items,
    })
  })
  return out
})
</script>

<template>
  <section v-if="rows.length" class="hl" aria-labelledby="hl-title">
    <h2 id="hl-title" class="hl__title">{{ t.promos.title }}</h2>
    <PromoCarousel v-for="r in rows" :id="r.id" :key="r.id" :title="r.title" :note="r.note" :items="r.items" />
  </section>
</template>

<style scoped>
.hl { padding: clamp(16px, 2.5vw, 28px) 0 clamp(20px, 3vw, 32px); border-top: 2px solid var(--fg-primary); }
.hl__title { margin: 0 0 4px; font-size: clamp(1.375rem, 2.4vw, 1.75rem); letter-spacing: -0.025em; font-weight: 600; }
</style>
