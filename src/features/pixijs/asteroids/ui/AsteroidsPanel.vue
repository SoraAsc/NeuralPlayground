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
  wave: number
  bestWave: number
  checkpointStatus: string
  viewLabel: string
  debugMode: boolean
  rotationAction: string
  propulsionAction: boolean
  shootingAction: boolean
  primaryRisk: number
  primaryThreatTime: number
  primaryThreatClearance: number
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  save: []
  load: []
  reset: []
}>()

const simulation = computed(() => ({
  status: props.metrics.mode === 'paused' ? ('stopped' as const) : ('training' as const),
}))
const statRows = computed<StatRow[]>(() => [
  { label: 'Ambientes paralelos', value: props.envCount, format: 'int' },
  { label: 'Episódios', value: props.metrics.episodes, format: 'int' },
  { label: `Recompensa (${props.viewLabel})`, value: props.reward, format: 'float' },
  { label: 'Melhor recompensa', value: props.bestReward, format: 'float' },
  { label: `Asteroides (${props.viewLabel})`, value: props.metrics.currentResult, format: 'int' },
  { label: 'Recorde de asteroides', value: props.metrics.bestResult, format: 'int' },
  { label: `Onda (${props.viewLabel})`, value: props.wave, format: 'int' },
  { label: 'Melhor onda', value: props.bestWave, format: 'int' },
  { label: `Sobrevivência (${props.viewLabel})`, value: props.survival, format: 'time' },
])

const infoSections: InfoSection[] = [
  {
    title: 'Ambientes vetorizados',
    content: [
      {
        type: 'text',
        value:
          'Doze naves jogam partidas independentes e alimentam uma única política PPO. Cada ambiente possui seus próprios asteroides, projéteis, pontuação e ondas.',
      },
    ],
  },
  {
    title: 'Estado e ações',
    content: [
      {
        type: 'steps',
        items: [
          'Velocidade e orientação da nave',
          'Direção relativa do alvo mais próximo',
          'Posição, velocidade relativa e tamanho das três maiores ameaças previstas',
          'Tempo e distância estimados até a maior aproximação de cada ameaça',
          'Cooldown da arma, para decidir quando um disparo está disponível',
          'Três eixos independentes: rotação (parado/direita/esquerda), propulsão (desligada/ligada) e tiro (não/sim)',
        ],
      },
    ],
  },
  {
    title: 'Recompensa',
    content: [
      {
        type: 'text',
        value:
          'A política recebe sinais pequenos por alinhar a proa e reduzir o risco previsto de colisão. Sobreviver, destruir asteroides e concluir ondas valem mais; colidir encerra o episódio com penalidade.',
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
    chart-label="Asteroides por episódio"
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
    <template #stats-extra>
      <section v-if="debugMode" class="border-t border-border px-4 py-4">
        <div class="mb-3 flex items-center gap-2">
          <span class="h-1.5 w-1.5 rounded-full bg-foreground/70" />
          <h3 class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Diagnóstico da IA
          </h3>
        </div>
        <div class="divide-y divide-border/40 border-y border-border/40">
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Rotação</span>
            <span class="font-mono text-xs text-foreground">{{ rotationAction }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Propulsão</span>
            <span class="font-mono text-xs text-foreground">{{ propulsionAction ? 'sim' : 'não' }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Disparo</span>
            <span class="font-mono text-xs text-foreground">{{ shootingAction ? 'sim' : 'não' }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Risco principal</span>
            <span class="font-mono text-xs text-foreground">{{ (primaryRisk * 100).toFixed(0) }}%</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Maior aproximação</span>
            <span class="font-mono text-xs text-foreground">{{ primaryThreatTime.toFixed(2) }}s</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Folga prevista</span>
            <span class="font-mono text-xs text-foreground">{{ primaryThreatClearance.toFixed(0) }}u</span>
          </div>
        </div>
      </section>
    </template>
  </simulation-panel>
</template>
