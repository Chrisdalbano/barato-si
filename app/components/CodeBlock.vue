<script setup lang="ts">
const props = defineProps<{ code: string; label: string }>()
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = false }, 1600)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <figure class="code">
    <figcaption>
      <span>{{ label }}</span>
      <button type="button" class="code__copy" @click="copy">{{ copied ? 'Copiado' : 'Copiar' }}</button>
    </figcaption>
    <pre><code>{{ code }}</code></pre>
  </figure>
</template>

<style scoped>
.code { margin: 0; border: 1px solid var(--fg-primary); background: var(--bg-surface); min-width: 0; }
.code figcaption { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border-strong); font-size: 0.75rem; color: var(--fg-secondary); }
.code__copy { border: 0; background: none; padding: 2px 0; font: inherit; font-weight: 600; color: var(--link-fg); cursor: pointer; }
.code__copy:hover { text-decoration: underline; text-underline-offset: 3px; }
pre { margin: 0; padding: 14px 12px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.6; color: var(--fg-primary); }
</style>
