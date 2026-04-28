<script setup lang="ts">
import { cn } from '@/shared/lib/utils'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    description?: string
    modelValue: number
    min: number
    max: number
    step?: number
    format?: 'int' | 'float' | 'float3' | 'pct' | 'exp'
    logScale?: boolean
  }>(),
  { step: 1, format: 'float', logScale: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const toSlider = (v: number) =>
  props.logScale
    ? ((Math.log(v) - Math.log(props.min)) / (Math.log(props.max) - Math.log(props.min))) * 100
    : ((v - props.min) / (props.max - props.min)) * 100

const fromSlider = (pos: number) =>
  props.logScale
    ? Math.round(
        Math.exp(Math.log(props.min) + (pos / 100) * (Math.log(props.max) - Math.log(props.min))),
      )
    : props.min + (pos / 100) * (props.max - props.min)

const pct = computed(() => toSlider(props.modelValue))

const fmt = computed(() => {
  const v = props.modelValue
  switch (props.format) {
    case 'int':
      return String(Math.round(v))
    case 'float':
      return v.toFixed(2)
    case 'float3':
      return v.toFixed(3)
    case 'pct':
      return `${Math.round(v)}%`
    case 'exp':
      return v.toExponential(4)
    default:
      return String(v)
  }
})

const onInput = (e: Event) => {
  const pos = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', fromSlider(pos))
}
</script>

<template>
  <div class="flex flex-col gap-2 group">
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-xs text-foreground">{{ label }}</span>
      <span class="text-xs font-mono tabular-nums text-muted-foreground shrink-0">{{ fmt }}</span>
    </div>

    <div class="relative flex items-center h-4">
      <div class="absolute w-full h-0.5 rounded-full bg-border">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-foreground/60 transition-all duration-75"
          :style="{ width: `${pct}%` }"
        />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="0.01"
        :value="pct"
        class="absolute inset-0 w-full opacity-0 cursor-pointer h-4"
        @input="onInput"
      />
      <div
        :class="
          cn(
            'absolute w-3.5 h-3.5 rounded-full bg-background border border-foreground/50',
            'shadow-sm pointer-events-none transition-all duration-75',
            'group-hover:border-foreground/80 group-hover:scale-110',
          )
        "
        :style="{ left: `calc(${pct}% - 7px)` }"
      />
    </div>

    <p v-if="description" class="text-[10px] text-muted-foreground/50 leading-relaxed -mt-0.5">
      {{ description }}
    </p>
  </div>
</template>
