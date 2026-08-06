<script setup lang="ts">
export interface CinematicStat {
  label: string
  value: string | number
  accent?: boolean
}

defineProps<{
  active: boolean
  title: string
  eyebrow?: string
  status: string
  statusColor?: 'green' | 'amber' | 'red'
  recordLabel: string
  recordValue: string | number
  recordDetail?: string
  stats: CinematicStat[]
  insightLabel: string
  insightValue: string
  insightDetail?: string
  meter?: number
  meterLabel?: string
  meterTone?: 'cyan' | 'amber' | 'red'
}>()
</script>

<template>
  <div v-if="active" class="cinematic-vignette pointer-events-none absolute inset-0 z-10" />

  <div
    v-if="active"
    class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-8 text-white"
  >
    <div>
      <p class="hud-kicker">{{ eyebrow ?? 'NEURAL PLAYGROUND / LIVE' }}</p>
      <h2 class="mt-1 text-2xl font-semibold tracking-tight">{{ title }}</h2>
      <div
        class="mt-3 flex items-center gap-2 text-[11px] font-medium tracking-wider text-white/60"
      >
        <span
          class="h-1.5 w-1.5 animate-pulse rounded-full"
          :class="{
            'bg-emerald-400': !statusColor || statusColor === 'green',
            'bg-amber-300': statusColor === 'amber',
            'bg-rose-400': statusColor === 'red',
          }"
        />
        {{ status.toUpperCase() }}
      </div>
    </div>
    <div class="text-right">
      <p class="hud-kicker">{{ recordLabel }}</p>
      <p class="mt-1 font-mono text-3xl font-light tabular-nums">{{ recordValue }}</p>
      <p v-if="recordDetail" class="mt-1 text-[10px] tracking-widest text-white/45">
        {{ recordDetail.toUpperCase() }}
      </p>
    </div>
  </div>

  <div
    v-if="active"
    class="cinematic-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-20 grid grid-cols-[1fr_auto_1fr] items-end gap-10 p-8 text-white"
  >
    <div class="max-w-sm">
      <p class="hud-kicker">{{ insightLabel }}</p>
      <p class="mt-1 text-lg font-medium tracking-wider">{{ insightValue }}</p>
      <p v-if="insightDetail" class="mt-1 font-mono text-[10px] text-white/50">
        {{ insightDetail }}
      </p>
      <div v-if="meter !== undefined" class="mt-3 h-1 overflow-hidden bg-white/15">
        <div
          class="h-full transition-[width] duration-150"
          :class="{
            'bg-cyan-300': !meterTone || meterTone === 'cyan',
            'bg-amber-300': meterTone === 'amber',
            'bg-rose-400': meterTone === 'red',
          }"
          :style="{ width: `${Math.max(0, Math.min(100, meter))}%` }"
        />
      </div>
      <p v-if="meter !== undefined && meterLabel" class="mt-2 hud-kicker">
        {{ meterLabel }}
      </p>
    </div>

    <div class="flex items-center gap-8 border-x border-white/15 px-10 text-center">
      <div v-for="stat in stats" :key="stat.label">
        <p class="hud-kicker">{{ stat.label }}</p>
        <p
          class="mt-1 font-mono text-3xl tabular-nums"
          :class="stat.accent ? 'text-amber-200' : ''"
        >
          {{ stat.value }}
        </p>
      </div>
    </div>

    <div />
  </div>
</template>

<style scoped>
.cinematic-vignette {
  background:
    linear-gradient(
      180deg,
      rgb(0 0 0 / 0.7) 0%,
      transparent 30%,
      transparent 66%,
      rgb(0 0 0 / 0.78) 100%
    ),
    radial-gradient(circle at center, transparent 45%, rgb(0 0 0 / 0.5) 100%);
}

.hud-kicker {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.24em;
  color: rgb(255 255 255 / 0.45);
}

@media (max-width: 900px) {
  .cinematic-hud-bottom {
    gap: 1rem;
    padding: 1.25rem;
  }
}
</style>
