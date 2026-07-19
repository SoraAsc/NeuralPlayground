<script setup lang="ts">
import { computed } from 'vue'
import { Database, Gauge, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import SimulationPanel from '@/features/unity/ui/SimulationPanel.vue'
import type { InfoSection, StatRow } from '@/features/unity/ui/SimulationPanel.vue'
import type { TrainingMetrics } from '@/features/game/model/training-metrics'

const props = defineProps<{
  metrics: TrainingMetrics
  envCount: number
  reward: number
  bestReward: number
  survival: number
  checkpointStatus: string
  viewLabel: string
  movingPipes: boolean
  pipeVerticalSpeed: number
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  save: []
  load: []
  reset: []
  'update:movingPipes': [value: boolean]
  'update:pipeVerticalSpeed': [value: number]
}>()

const simulation = computed(() => ({
  status: props.metrics.mode === 'paused' ? ('stopped' as const) : ('training' as const),
}))
const statRows = computed<StatRow[]>(() => [
  { label: 'Ambientes paralelos', value: props.envCount, format: 'int' },
  { label: 'Episódios', value: props.metrics.episodes, format: 'int' },
  { label: `Recompensa (${props.viewLabel})`, value: props.reward, format: 'float' },
  { label: 'Melhor recompensa', value: props.bestReward, format: 'float' },
  { label: `Canos (${props.viewLabel})`, value: props.metrics.currentResult, format: 'int' },
  { label: 'Recorde de canos', value: props.metrics.bestResult, format: 'int' },
  { label: `Sobrevivência (${props.viewLabel})`, value: props.survival, format: 'time' },
])

const infoSections: InfoSection[] = [
  {
    title: 'Ambientes vetorizados',
    content: [
      {
        type: 'text',
        value:
          'Doze pássaros executam episódios independentes e alimentam uma única política PPO. Estados, ações, recompensas e términos são enviados em um batch a cada passo.',
      },
    ],
  },
  {
    title: 'Estado e ação',
    content: [
      {
        type: 'steps',
        items: [
          'Altura e velocidade vertical do pássaro',
          'Distância horizontal até o próximo cano',
          'Centro do vão e distância vertical até ele',
          'Velocidade vertical do vão quando os canos estão em movimento',
          'Ação discreta: aguardar ou bater as asas',
        ],
      },
    ],
  },
  {
    title: 'Visualização',
    content: [
      {
        type: 'text',
        value:
          'Cada cor representa um ambiente completo, incluindo pássaro e canos. O espaçamento varia a cada obstáculo; maior opacidade indica melhor recompensa e sobrevivência no episódio atual.',
      },
    ],
  },
]
</script>

<template>
  <simulation-panel
    :simulation="simulation"
    :stat-rows="statRows"
    :reward-history="metrics.history"
    chart-label="Canos por episódio"
    :info-sections="infoSections"
    default-tab="stats"
  >
    <template #params>
      <div class="flex flex-col divide-y divide-border/40">
        <section class="flex flex-col gap-4 px-4 py-4">
          <div class="flex items-center gap-1.5">
            <gauge class="h-3 w-3 text-muted-foreground/60" />
            <span class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Simulação
            </span>
          </div>
          <param-slider
            label="Velocidade"
            description="Passos vetorizados processados por frame"
            :model-value="metrics.stepsPerFrame"
            :min="1"
            :max="100"
            format="int"
            :log-scale="true"
            @update:model-value="emit('update:speed', $event)"
          />
          <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-xs text-foreground">Movimento dos canos</span>
              <span class="text-[10px] text-muted-foreground/50">opcional</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <base-button
                size="sm"
                :variant="!movingPipes ? 'primary' : 'outline'"
                @click="emit('update:movingPipes', false)"
              >
                Parados
              </base-button>
              <base-button
                size="sm"
                :variant="movingPipes ? 'primary' : 'outline'"
                @click="emit('update:movingPipes', true)"
              >
                Subindo/descendo
              </base-button>
            </div>
          </div>
          <param-slider
            v-if="movingPipes"
            label="Velocidade vertical"
            description="Unidades por segundo; limitado a uma faixa atravessável"
            :model-value="pipeVerticalSpeed"
            :min="5"
            :max="45"
            :step="1"
            format="int"
            @update:model-value="emit('update:pipeVerticalSpeed', $event)"
          />
        </section>
        <section class="flex flex-col gap-3 px-4 py-4">
          <div class="flex items-center gap-1.5">
            <database class="h-3 w-3 text-muted-foreground/60" />
            <span class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Modelo PPO
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <base-button size="sm" @click="emit('save')">Salvar IA</base-button>
            <base-button size="sm" @click="emit('load')">Carregar IA</base-button>
            <base-button class="col-span-2" variant="danger" size="sm" @click="emit('reset')">
              <rotate-ccw /> Reiniciar aprendizado
            </base-button>
          </div>
          <p class="text-[10px] leading-relaxed text-muted-foreground/60">
            {{ checkpointStatus }}
          </p>
        </section>
      </div>
    </template>
  </simulation-panel>
</template>
