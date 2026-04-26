<script setup lang="ts" generic="TStats extends { status?: 'stopped' | 'training' | 'testing' }">
import { ref, computed } from 'vue'
import { Brain, BarChart2, Info } from '@lucide/vue'
import { cn } from '@/shared/lib/utils'

export type SimPanelTab = 'params' | 'stats' | 'info'

export interface StatRow {
  label: string
  value: string | number
  format?: 'int' | 'float' | 'float3' | 'pct' | 'time' | 'str'
}

export type InfoContent =
  | { type: 'text'; value: string }
  | { type: 'steps'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'formula'; value: string }
  | { type: 'params'; items: { symbol: string; name: string; description: string }[] }

export interface InfoSection {
  title: string
  content: InfoContent[]
}

const props = withDefaults(
  defineProps<{
    simulation?: TStats | null
    statRows?: StatRow[]
    rewardHistory?: number[]
    chartLabel?: string
    infoSections?: InfoSection[]
    defaultTab?: SimPanelTab
    showParams?: boolean
  }>(),
  {
    statRows: () => [],
    rewardHistory: () => [],
    chartLabel: 'Gráfico de recompensa por episódio',
    infoSections: () => [],
    defaultTab: 'stats',
    showParams: true,
  },
)

const activeTab = ref<SimPanelTab>(props.defaultTab)

const isActive = computed(() => !!props.simulation && props.simulation.status !== 'stopped')

const rewardPoints = computed(() => {
  const h = props.rewardHistory
  if (h.length < 2) return ''
  const W = 280,
    H = 100
  const min = Math.min(...h),
    max = Math.max(...h)
  const range = max - min || 1
  return h.map((v, i) => `${(i / (h.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ')
})

const tabs = computed(() => {
  const all = [
    { id: 'params' as const, label: 'Params', icon: Brain },
    { id: 'stats' as const, label: 'Stats', icon: BarChart2 },
    { id: 'info' as const, label: 'Info', icon: Info },
  ]
  return props.showParams ? all : all.filter((t) => t.id !== 'params')
})

const formatTime = (s: number) => {
  if (!s) return '0s'

  const seconds = Math.floor(s)

  const years = Math.floor(seconds / (60 * 60 * 24 * 365))
  const months = Math.floor((seconds % (60 * 60 * 24 * 365)) / (60 * 60 * 24 * 30))
  const days = Math.floor((seconds % (60 * 60 * 24 * 30)) / (60 * 60 * 24))
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)
  const secs = seconds % 60

  const parts = [
    years && `${years}y`,
    months && `${months}mo`,
    days && `${days}d`,
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    secs && `${secs}s`,
  ].filter(Boolean)

  return parts.join(' ')
}

const fmt = (row: StatRow): string => {
  const v = row.value
  switch (row.format) {
    case 'int':
      return String(Math.round(Number(v)))
    case 'float':
      return Number(v).toFixed(2)
    case 'float3':
      return Number(v).toFixed(3)
    case 'pct':
      return `${v}%`
    case 'time':
      return formatTime(Number(v))
    default:
      return String(v)
  }
}
</script>

<template>
  <aside
    :class="
      cn(
        'flex flex-col bg-card overflow-hidden',
        'w-[320px] grow h-[80vh] min-w-70 border border-border',
      )
    "
  >
    <!-- Tab bar -->
    <div class="flex border-b border-border shrink-0 pt-2">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="
          cn(
            'flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5',
            'text-xs font-medium transition-colors border-b-2',
            activeTab === tab.id
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )
        "
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" class="h-3.5 w-3.5" />
        {{ tab.label }}
      </button>
    </div>

    <!-- PARAMS -->
    <div v-if="activeTab === 'params'" class="flex flex-col flex-1 overflow-y-auto">
      <slot name="params">
        <div class="flex flex-1 items-center justify-center p-6">
          <p class="text-xs text-muted-foreground/40 text-center">Nenhum parâmetro configurado.</p>
        </div>
      </slot>
    </div>

    <!-- STATS -->
    <div v-else-if="activeTab === 'stats'" class="flex flex-col flex-1 overflow-y-auto">
      <div class="border-b border-border p-3 shrink-0">
        <p class="text-[10px] text-muted-foreground mb-2 text-center">{{ chartLabel }}</p>
        <div
          :class="
            cn(
              'bg-background rounded border border-border/50',
              'h-25 flex items-center justify-center overflow-hidden',
            )
          "
        >
          <svg
            v-if="rewardPoints"
            viewBox="0 0 280 100"
            class="w-full h-full"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="25"
              x2="280"
              y2="25"
              stroke="currentColor"
              stroke-opacity="0.06"
              stroke-width="1"
            />
            <line
              x1="0"
              y1="50"
              x2="280"
              y2="50"
              stroke="currentColor"
              stroke-opacity="0.06"
              stroke-width="1"
            />
            <line
              x1="0"
              y1="75"
              x2="280"
              y2="75"
              stroke="currentColor"
              stroke-opacity="0.06"
              stroke-width="1"
            />
            <polyline
              :points="rewardPoints + ' 280,100 0,100'"
              fill="currentColor"
              fill-opacity="0.06"
              stroke="none"
            />
            <polyline
              :points="rewardPoints"
              fill="none"
              stroke="currentColor"
              stroke-opacity="0.8"
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
          <span v-else class="text-[10px] text-muted-foreground/40">Sem dados</span>
        </div>
      </div>

      <div class="divide-y divide-border/50">
        <div
          v-for="row in statRows"
          :key="row.label"
          class="flex items-center justify-between px-4 py-2"
        >
          <span class="text-xs text-muted-foreground">{{ row.label }}</span>
          <span class="text-xs font-mono tabular-nums text-foreground">{{ fmt(row) }}</span>
        </div>
        <div v-if="!statRows.length" class="px-4 py-6 text-center">
          <p class="text-xs text-muted-foreground/40">Nenhuma estatística disponível.</p>
        </div>
      </div>

      <slot name="stats-extra" />
    </div>

    <div v-else-if="activeTab === 'info'" class="flex flex-col flex-1 overflow-y-auto">
      <div class="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <span
          class="h-1.5 w-1.5 rounded-full shrink-0 transition-colors"
          :class="isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'"
        />
        <span class="text-xs text-muted-foreground capitalize">
          {{ simulation?.status ?? 'stopped' }}
        </span>
      </div>

      <div class="divide-y divide-border/40">
        <section
          v-for="section in infoSections"
          :key="section.title"
          class="px-4 py-4 flex flex-col gap-3"
        >
          <h3 class="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            {{ section.title }}
          </h3>

          <template v-for="(block, bi) in section.content" :key="bi">
            <!-- text -->
            <p v-if="block.type === 'text'" class="text-xs text-muted-foreground leading-relaxed">
              {{ block.value }}
            </p>

            <!-- steps  01 02 03 -->
            <ol v-else-if="block.type === 'steps'" class="flex flex-col gap-1.5">
              <li
                v-for="(item, ii) in block.items"
                :key="ii"
                class="flex gap-2.5 text-xs text-muted-foreground"
              >
                <span class="shrink-0 font-mono text-foreground/30 w-4 text-right select-none">
                  {{ String(ii + 1).padStart(2, '0') }}
                </span>
                <span class="leading-relaxed">{{ item }}</span>
              </li>
            </ol>

            <!-- numbered  1 2 3 -->
            <ol v-else-if="block.type === 'numbered'" class="flex flex-col gap-1.5">
              <li
                v-for="(item, ii) in block.items"
                :key="ii"
                class="flex gap-2.5 text-xs text-muted-foreground"
              >
                <span class="shrink-0 font-mono text-foreground/40 w-3 text-right select-none">
                  {{ ii + 1 }}
                </span>
                <span class="leading-relaxed">{{ item }}</span>
              </li>
            </ol>

            <!-- formula -->
            <div
              v-else-if="block.type === 'formula'"
              :class="
                cn(
                  'bg-background border border-border/50 px-3 py-2.5',
                  'rounded font-mono text-[11px] text-foreground/80',
                  'leading-relaxed overflow-x-auto',
                )
              "
            >
              {{ block.value }}
            </div>

            <!-- param cards -->
            <div v-else-if="block.type === 'params'" class="flex flex-col gap-2">
              <div
                v-for="p in block.items"
                :key="p.symbol"
                class="flex gap-3 rounded border border-border/50 bg-background/40 px-3 py-2.5"
              >
                <span
                  :class="
                    cn(
                      'flex items-center justify-center font-mono',
                      'bg-foreground/5 text-foreground/70 text-[11px]',
                      'shrink-0 w-5 h-5 rounded mt-0.5',
                    )
                  "
                >
                  {{ p.symbol }}
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-medium text-foreground">{{ p.name }}</span>
                  <span class="text-[11px] text-muted-foreground leading-relaxed">{{
                    p.description
                  }}</span>
                </div>
              </div>
            </div>
          </template>
        </section>

        <div v-if="!infoSections.length" class="px-4 py-6 text-center">
          <p class="text-xs text-muted-foreground/40">Nenhuma informação disponível.</p>
        </div>
      </div>

      <slot name="info-extra" />
    </div>
  </aside>
</template>
