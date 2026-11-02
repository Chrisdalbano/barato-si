import { nextTick, onUnmounted, ref } from 'vue'

/**
 * Open/close, focus and scroll lock for a drawer. Focus moves in on open, stays
 * in while open, returns to the trigger on close; Escape closes.
 */
export function useDrawer() {
  const open = ref(false)
  const panel = ref<HTMLElement | null>(null)
  const trigger = ref<HTMLElement | null>(null)

  function lock(on: boolean) {
    document.documentElement.style.overflow = on ? 'hidden' : ''
  }
  async function show() {
    open.value = true
    lock(true)
    await nextTick()
    panel.value?.focus()
  }
  function hide() {
    if (!open.value) return
    open.value = false
    lock(false)
    trigger.value?.focus()
  }
  function onKeydown(event: KeyboardEvent) {
    if (!open.value) return
    if (event.key === 'Escape') { hide(); return }
    if (event.key !== 'Tab' || !panel.value) return
    const items = [...panel.value.querySelectorAll<HTMLElement>('button, input, select, a[href]')].filter(el => el.offsetParent !== null)
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    const current = document.activeElement
    if (event.shiftKey && (current === first || current === panel.value)) { event.preventDefault(); last.focus() } else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus() }
  }
  onUnmounted(() => { if (open.value) lock(false) })

  return { open, panel, trigger, show, hide, onKeydown }
}
