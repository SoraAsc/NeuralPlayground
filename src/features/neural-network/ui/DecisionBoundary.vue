<script setup lang="ts">
import type { DatasetPoint, DecisionCell } from '@/features/neural-network/model/logic-gate-lab'

defineProps<{
  cells: DecisionCell[]
  resolution: number
  predictions: number[]
  points: DatasetPoint[]
  datasetName: string
}>()

const cellColor = (value: number) => {
  return `color-mix(in oklch, var(--background) ${Math.round((1 - value) * 100)}%, var(--foreground))`
}
</script>

<template>
  <figure class="space-y-3">
    <figcaption class="flex items-center justify-between gap-4">
      <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Saída da rede · probabilidade
      </span>
      <div class="flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
        <span>0</span>
        <span
          class="h-2.5 w-20 border border-border bg-linear-to-r from-background to-foreground"
        />
        <span>1</span>
      </div>
    </figcaption>
    <div class="relative aspect-square overflow-hidden border border-border bg-background">
      <svg
        viewBox="0 0 100 100"
        class="h-full w-full"
        role="img"
        :aria-label="`Fronteira de decisão da rede para ${datasetName}`"
      >
        <rect
          v-for="cell in cells"
          :key="`${cell.x}-${cell.y}`"
          :x="(cell.x * 100) / resolution"
          :y="100 - ((cell.y + 1) * 100) / resolution"
          :width="100 / resolution + 0.2"
          :height="100 / resolution + 0.2"
          :fill="cellColor(cell.value)"
        />
        <g v-for="(point, index) in points" :key="index">
          <rect
            v-if="points.length <= 10"
            :x="point.x * 100 - 6"
            :y="100 - point.y * 100 + (point.y > 0.5 ? 3.3 : -8.7)"
            width="12"
            height="5.4"
            rx="1"
            fill="var(--background)"
            stroke="var(--border)"
            stroke-width="0.45"
          />
          <circle
            :cx="point.x * 100"
            :cy="100 - point.y * 100"
            :r="points.length > 10 ? 1.7 : 3.2"
            :fill="point.target ? 'var(--foreground)' : 'var(--background)'"
            :stroke="point.target ? 'var(--background)' : 'var(--foreground)'"
            stroke-width="1.5"
          />
          <text
            v-if="points.length <= 10"
            :x="point.x * 100"
            :y="100 - point.y * 100 + (point.y > 0.5 ? 7 : -5)"
            text-anchor="middle"
            font-size="3.2"
            fill="var(--foreground)"
          >
            {{ (predictions[index] ?? 0).toFixed(2) }}
          </text>
        </g>
      </svg>
      <span
        class="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted-foreground"
        >Entrada X₁</span
      >
      <span
        class="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 font-mono text-[9px] text-muted-foreground"
        >Entrada X₂</span
      >
    </div>
  </figure>
</template>
