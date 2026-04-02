import { ref, watch } from 'vue'

type Theme = 'dark' | 'light'

const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'dark')

watch(
  theme,
  (value) => {
    document.documentElement.classList.toggle('dark', value === 'dark')
    localStorage.setItem('theme', value)
  },
  { immediate: true },
)

export function useTheme() {
  const toggleTheme = () => {
    const nextTheme = theme.value === 'dark' ? 'light' : 'dark'

    if (!document.startViewTransition) {
      theme.value = nextTheme
      return
    }

    document.startViewTransition(() => {
      theme.value = nextTheme
    })
  }

  return {
    theme,
    toggleTheme,
  }
}
