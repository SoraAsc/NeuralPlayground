import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export function useCinematicMode(onResize?: () => void) {
  const stage = ref<HTMLElement | null>(null)
  const isFullscreen = ref(false)

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await stage.value?.requestFullscreen()
  }

  function syncFullscreen() {
    isFullscreen.value = document.fullscreenElement === stage.value
    requestAnimationFrame(() => onResize?.())
  }

  function handleShortcut(event: KeyboardEvent) {
    if (event.key.toLowerCase() === 'f' && !event.repeat) void toggleFullscreen()
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', syncFullscreen)
    window.addEventListener('keydown', handleShortcut)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', syncFullscreen)
    window.removeEventListener('keydown', handleShortcut)
  })

  return { stage: stage as Ref<HTMLElement | null>, isFullscreen, toggleFullscreen }
}
