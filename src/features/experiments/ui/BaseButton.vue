<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/lib/utils'

interface Props {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'icon' | 'dot'
  className?: string
  active?: boolean
  showDot?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'outline',
  size: 'dot',
  active: false,
  showDot: false,
})

const variants = {
  primary: 'bg-accent text-foreground border-primary/60',
  outline:
    'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30',
  ghost: 'border-transparent hover:bg-accent hover:text-accent-foreground text-foreground',
  danger: 'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90',
}

const sizes = {
  dot: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'h-9 px-3 text-sm gap-2',
  sm: 'h-8 px-2 text-xs gap-1',
  icon: 'h-7 w-7 p-0',
}

const buttonClasses = computed(() =>
  cn(
    'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors shrink-0 border',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
    variants[props.variant],
    sizes[props.size],
    props.className,
  ),
)

const dotClasses = computed(() =>
  cn(
    'w-1.5 h-1.5 rounded-full transition-colors',
    props.active ? 'bg-foreground/50' : 'bg-muted-foreground/40',
  ),
)
</script>

<template>
  <button :class="buttonClasses" v-bind="$attrs">
    <span v-if="showDot" :class="dotClasses"></span>

    <slot />

    <slot name="right" />
  </button>
</template>
