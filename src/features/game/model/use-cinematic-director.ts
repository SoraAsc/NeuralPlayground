import { onUnmounted, ref, watch, type Ref } from 'vue'

export function useCinematicDirector(
  active: Ref<boolean>,
  options: { count: Ref<number>; intervalMs?: number; onFocus: (index: number) => void },
) {
  const enabled = ref(false)
  const index = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function focusNext() {
    const count = Math.max(1, options.count.value)
    index.value = (index.value + 1) % count
    options.onFocus(index.value)
  }

  function start() {
    stop()
    if (enabled.value && active.value) timer = setInterval(focusNext, options.intervalMs ?? 14000)
  }

  function toggle() {
    enabled.value = !enabled.value
    start()
  }

  watch([active, enabled, options.count], start)
  onUnmounted(stop)
  return { enabled, toggle, start, stop }
}
