<script setup lang="ts">
import { Brain, Sun, Moon } from '@lucide/vue'
import { cn } from '@/shared/lib/utils.ts'
import { useTheme } from '@/shared/lib/theme/useTheme'

const { theme, toggleTheme } = useTheme()
</script>

<template>
  <header
    :class="
      cn(
        'border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50',
        'flex items-center justify-between h-14 px-4',
      )
    "
  >
    <router-link
      to="/"
      :class="
        cn(
          'flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity',
          'font-semibold tracking-tight',
        )
      "
    >
      <Brain /> Neural Playground
    </router-link>
    <button
      @click="toggleTheme"
      class="p-2 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Toggle theme"
    >
      <Sun v-if="theme === 'dark'" class="h-4 w-4" />
      <Moon v-else class="h-4 w-4" />
    </button>
  </header>
</template>
