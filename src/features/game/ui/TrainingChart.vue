<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    values: number[]
    label: string
    movingAverageWindow?: number
  }>(),
  { movingAverageWindow: 10 },
)

const WIDTH = 300
const HEIGHT = 150
const LEFT = 38
const RIGHT = 12
const TOP = 12
const BOTTOM = 24
const plotWidth = WIDTH - LEFT - RIGHT
const plotHeight = HEIGHT - TOP - BOTTOM

const hoveredIndex = ref<number | null>(null)

const cleanValues = computed(() => props.values.filter(Number.isFinite))

const movingAverage = computed(() => {
  const values = cleanValues.value
  const window = Math.max(1, Math.min(props.movingAverageWindow, values.length))
  let sum = 0
  return values.map((value, index) => {
    sum += value
    if (index >= window) sum -= values[index - window] ?? 0
    return sum / Math.min(index + 1, window)
  })
})

const bounds = computed(() => {
  if (!cleanValues.value.length) return { min: 0, max: 1 }
  const min = Math.min(...cleanValues.value, ...movingAverage.value)
  const max = Math.max(...cleanValues.value, ...movingAverage.value)
  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * 0.1)
    return { min: min - padding, max: max + padding }
  }
  const padding = (max - min) * 0.08
  return { min: min - padding, max: max + padding }
})

const xFor = (index: number) =>
  LEFT + (index / Math.max(1, cleanValues.value.length - 1)) * plotWidth
const yFor = (value: number) =>
  TOP + ((bounds.value.max - value) / (bounds.value.max - bounds.value.min)) * plotHeight

const pointsFor = (values: number[]) =>
  values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ')

const rawPoints = computed(() => pointsFor(cleanValues.value))
const averagePoints = computed(() => pointsFor(movingAverage.value))
const areaPoints = computed(() =>
  cleanValues.value.length
    ? `${rawPoints.value} ${xFor(cleanValues.value.length - 1)},${TOP + plotHeight} ${LEFT},${TOP + plotHeight}`
    : '',
)

const minimum = computed(() => Math.min(...cleanValues.value))
const maximum = computed(() => Math.max(...cleanValues.value))
const latest = computed(() => cleanValues.value.at(-1))
const bestY = computed(() => yFor(maximum.value))

const yTicks = computed(() =>
  [bounds.value.max, (bounds.value.max + bounds.value.min) / 2, bounds.value.min].map((value) => ({
    value,
    y: yFor(value),
  })),
)

const hoveredValue = computed<number | null>(() =>
  hoveredIndex.value === null ? null : (cleanValues.value[hoveredIndex.value] ?? null),
)
const hoveredAverage = computed<number | null>(() =>
  hoveredIndex.value === null ? null : (movingAverage.value[hoveredIndex.value] ?? null),
)
const hoveredPlotValue = computed(() => hoveredAverage.value ?? hoveredValue.value)
const tooltipX = computed(() =>
  hoveredIndex.value === null
    ? 0
    : Math.min(WIDTH - 89, Math.max(LEFT + 4, xFor(hoveredIndex.value) + 7)),
)
const tooltipY = computed(() =>
  hoveredValue.value === null
    ? 0
    : Math.min(HEIGHT - 47, Math.max(TOP + 3, yFor(hoveredValue.value) - 20)),
)

function formatValue(value: number | undefined | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  const magnitude = Math.abs(value)
  if (magnitude >= 1000)
    return Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(
      value,
    )
  if (Number.isInteger(value) || magnitude >= 100) return value.toFixed(0)
  return value.toFixed(2)
}

function handlePointerMove(event: PointerEvent) {
  if (cleanValues.value.length < 2) return
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
  const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH
  const ratio = Math.max(0, Math.min(1, (svgX - LEFT) / plotWidth))
  hoveredIndex.value = Math.round(ratio * (cleanValues.value.length - 1))
}
</script>

<template>
  <figure class="flex flex-col gap-2" :aria-label="label">
    <figcaption class="flex items-center justify-between gap-3 px-0.5">
      <span class="truncate text-[10px] text-muted-foreground">{{ label }}</span>
      <dl
        v-if="cleanValues.length"
        class="flex shrink-0 items-center gap-2 font-mono text-[9px] tabular-nums"
      >
        <div class="flex gap-1">
          <dt class="text-muted-foreground/50">MIN</dt>
          <dd>{{ formatValue(minimum) }}</dd>
        </div>
        <div class="flex gap-1">
          <dt class="text-muted-foreground/50">MAX</dt>
          <dd>{{ formatValue(maximum) }}</dd>
        </div>
        <div class="flex gap-1">
          <dt class="text-muted-foreground/50">ATUAL</dt>
          <dd>{{ formatValue(latest) }}</dd>
        </div>
      </dl>
    </figcaption>

    <div class="relative h-38 overflow-hidden rounded border border-border/60 bg-background">
      <svg
        v-if="cleanValues.length >= 2"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        class="h-full w-full touch-none select-none"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`${label}. ${cleanValues.length} episódios. Valor atual ${formatValue(latest)}.`"
        @pointermove="handlePointerMove"
        @pointerleave="hoveredIndex = null"
      >
        <g v-for="tick in yTicks" :key="tick.y">
          <line
            :x1="LEFT"
            :x2="WIDTH - RIGHT"
            :y1="tick.y"
            :y2="tick.y"
            stroke="currentColor"
            stroke-opacity="0.08"
          />
          <text
            :x="LEFT - 5"
            :y="tick.y + 3"
            text-anchor="end"
            fill="currentColor"
            fill-opacity="0.4"
            font-size="8"
          >
            {{ formatValue(tick.value) }}
          </text>
        </g>

        <line
          :x1="LEFT"
          :x2="WIDTH - RIGHT"
          :y1="bestY"
          :y2="bestY"
          stroke="currentColor"
          stroke-opacity="0.25"
          stroke-dasharray="3 4"
        />
        <polygon :points="areaPoints" fill="currentColor" fill-opacity="0.035" />
        <polyline
          :points="rawPoints"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.22"
          stroke-width="1"
          stroke-linejoin="round"
        />
        <polyline
          :points="averagePoints"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.9"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <text :x="LEFT" :y="HEIGHT - 7" fill="currentColor" fill-opacity="0.35" font-size="8">
          1
        </text>
        <text
          :x="WIDTH - RIGHT"
          :y="HEIGHT - 7"
          text-anchor="end"
          fill="currentColor"
          fill-opacity="0.35"
          font-size="8"
        >
          {{ cleanValues.length }} episódios
        </text>

        <g v-if="hoveredIndex !== null && hoveredValue !== null">
          <line
            :x1="xFor(hoveredIndex)"
            :x2="xFor(hoveredIndex)"
            :y1="TOP"
            :y2="TOP + plotHeight"
            stroke="currentColor"
            stroke-opacity="0.35"
            stroke-dasharray="2 2"
          />
          <circle
            :cx="xFor(hoveredIndex)"
            :cy="yFor(hoveredPlotValue ?? 0)"
            r="3"
            fill="var(--background)"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <g :transform="`translate(${tooltipX} ${tooltipY})`" class="pointer-events-none">
            <rect
              width="84"
              height="40"
              rx="3"
              fill="var(--card)"
              stroke="currentColor"
              stroke-opacity="0.25"
            />
            <text x="6" y="12" fill="currentColor" fill-opacity="0.55" font-size="8">
              EPISÓDIO {{ hoveredIndex + 1 }}
            </text>
            <text x="6" y="24" fill="currentColor" font-size="9">
              Valor {{ formatValue(hoveredValue) }}
            </text>
            <text x="6" y="35" fill="currentColor" fill-opacity="0.65" font-size="8">
              Média {{ formatValue(hoveredAverage) }}
            </text>
          </g>
        </g>
      </svg>

      <div
        v-else
        class="flex h-full items-center justify-center text-[10px] text-muted-foreground/40"
      >
        Aguardando dados dos episódios
      </div>
    </div>

    <div
      v-if="cleanValues.length >= 2"
      class="flex items-center justify-end gap-3 px-0.5 text-[9px] text-muted-foreground/55"
    >
      <span class="flex items-center gap-1.5"><span class="h-px w-4 bg-foreground/25" />Bruto</span>
      <span class="flex items-center gap-1.5"
        ><span class="h-0.5 w-4 bg-foreground/90" />Média de
        {{ movingAverageWindow }} episódios</span
      >
    </div>
  </figure>
</template>
