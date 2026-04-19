<script setup lang="ts">
import { cn } from '@/shared/lib/utils'
withDefaults(
  defineProps<{
    href: string
    category: string
    title: string
    description: string
    isEnabled?: boolean
  }>(),
  {
    isEnabled: true,
  },
)
</script>

<template>
  <router-link
    :to="href"
    :class="
      cn(
        'border border-border bg-card p-6',
        'transition-all hover:border-primary/50 hover:shadow-md cursor-pointer',
        !isEnabled && 'pointer-events-none opacity-60',
      )
    "
  >
    <div class="flex items-start justify-between mb-4">
      <span class="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {{ category }}
      </span>
      <span
        v-if="!isEnabled"
        class="text-xs text-muted-foreground border border-border px-2 py-0.5"
      >
        Em breve
      </span>
    </div>
    <h3 class="text-lg font-semibold text-foreground mb-2">{{ title }}</h3>
    <p class="text-sm text-muted-foreground mb-4 leading-relaxed">
      {{ description }}
    </p>
  </router-link>
</template>
