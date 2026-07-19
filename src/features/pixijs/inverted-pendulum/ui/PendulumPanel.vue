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
  angle: number
  force: number
  cartPosition: number
  cartVelocity: number
  reward: number
  bestReward: number
  angularVelocity: number
  checkpointStatus: string
  debugMode: boolean
  training: boolean
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  reset: []
  save: []
  load: []
  'toggle-training': []
}>()

const simulation = computed(() => ({
  status:
    props.metrics.mode === 'paused'
      ? ('stopped' as const)
      : props.metrics.mode === 'evaluation'
        ? ('testing' as const)
        : ('training' as const),
}))
const statRows = computed<StatRow[]>(() => [
  { label: 'Episódios', value: props.metrics.episodes, format: 'int' },
  { label: 'Posição da base', value: props.cartPosition, format: 'float3' },
  { label: 'Velocidade da base', value: props.cartVelocity, format: 'float3' },
  { label: 'Ângulo', value: (props.angle * 180) / Math.PI, format: 'float' },
  { label: 'Velocidade angular', value: props.angularVelocity, format: 'float3' },
  { label: 'Força aplicada', value: props.force, format: 'float' },
  { label: 'Recompensa atual', value: props.reward, format: 'int' },
  { label: 'Melhor recompensa', value: props.bestReward, format: 'int' },
  { label: 'Estabilidade atual', value: props.metrics.currentResult, format: 'time' },
  { label: 'Melhor estabilidade', value: props.metrics.bestResult, format: 'time' },
])

const infoSections: InfoSection[] = [
  {
    title: 'CartPole-v1',
    content: [
      {
        type: 'text',
        value:
          'A física, o estado, o reset, os limites e a recompensa seguem o benchmark CartPole-v1. A ação foi adaptada de esquerda/direita para uma força contínua treinada com PPO.',
      },
    ],
  },
  {
    title: 'Estado',
    content: [
      {
        type: 'steps',
        items: [
          'Posição horizontal da base',
          'Velocidade horizontal da base',
          'Ângulo do pêndulo',
          'Velocidade angular do pêndulo',
        ],
      },
    ],
  },
  {
    title: 'Objetivo',
    content: [
      {
        type: 'text',
        value:
          'Cada passo vivo vale +1. O episódio termina apenas ao ultrapassar ±12° ou quando a base sai de ±2,4 unidades. Não há limite de passos ou pontuação máxima.',
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
    chart-label="Estabilidade por episódio"
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
            description="Passos físicos processados por frame"
            :model-value="metrics.stepsPerFrame"
            :min="1"
            :max="100"
            format="int"
            :log-scale="true"
            @update:model-value="emit('update:speed', $event)"
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
            <base-button
              class="col-span-2"
              size="sm"
              variant="outline"
              @click="emit('toggle-training')"
            >
              {{ training ? 'Testar política' : 'Voltar a treinar' }}
            </base-button>
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
    <template #stats-extra>
      <section v-if="debugMode" class="border-t border-border px-4 py-4">
        <div class="mb-3 flex items-center gap-2">
          <span class="h-1.5 w-1.5 rounded-full bg-foreground/70" />
          <h3 class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Diagnóstico da IA
          </h3>
        </div>
        <div class="mb-3 rounded border border-border/50 bg-background/40 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          s = [{{ cartPosition.toFixed(3) }}, {{ cartVelocity.toFixed(3) }},
          {{ angle.toFixed(3) }}, {{ angularVelocity.toFixed(3) }}]
        </div>
        <div class="divide-y divide-border/40 border-y border-border/40">
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Ação contínua</span>
            <span class="font-mono text-xs text-foreground">{{ (force / 10).toFixed(3) }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Limite angular</span>
            <span class="font-mono text-xs text-foreground">±12°</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Limite da pista</span>
            <span class="font-mono text-xs text-foreground">±2.4</span>
          </div>
        </div>
      </section>
    </template>
  </simulation-panel>
</template>
