<script setup lang="ts">
import { computed } from 'vue'
import { Cpu, Database, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import SimulationPanel from '@/features/unity/ui/SimulationPanel.vue'
import type { InfoSection, StatRow } from '@/features/unity/ui/SimulationPanel.vue'
import type { TrainingMetrics } from '@/features/game/model/training-metrics'

const props = defineProps<{
  metrics: TrainingMetrics
  source: string
  kartSpeed: number
  checkpoint: number
  laps: number
  timeout: number
  maxTimeout: number
  checkpointStatus: string
  lastReward: number
  bestLaps: number
  checkpointLimit: number
  trackType: 'circuit' | 'oval' | 'snake' | 'crazy'
  debugMode: boolean
  policyInputs: number[]
  policyOutputs: number[]
  appliedForward: number
  appliedSteer: number
  frontSensors: number[]
  rearSensors: number[]
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  save: []
  load: []
  clear: []
  'toggle-training': []
  'update:checkpointLimit': [value: number]
  'update:trackType': [value: 'circuit' | 'oval' | 'snake' | 'crazy']
}>()

const simulation = computed(() => ({
  status: props.metrics.mode === 'paused' ? ('stopped' as const) : ('training' as const),
}))
const statRows = computed<StatRow[]>(() => [
  { label: 'Episódios', value: props.metrics.episodes, format: 'int' },
  { label: 'Controle', value: props.source || 'carregando', format: 'str' },
  { label: 'Velocidade do kart', value: props.kartSpeed, format: 'int' },
  { label: 'Checkpoint', value: props.checkpoint, format: 'int' },
  { label: 'Voltas', value: props.laps, format: 'int' },
  { label: 'Tempo sem progresso', value: props.timeout, format: 'float' },
  { label: 'Limite por checkpoint', value: props.maxTimeout, format: 'float' },
  { label: 'Recompensa acumulada', value: props.metrics.currentResult, format: 'float' },
  { label: 'Última recompensa', value: props.lastReward, format: 'float' },
  { label: 'Melhor recompensa', value: props.metrics.bestResult, format: 'float' },
  { label: 'Maior número de voltas', value: props.bestLaps, format: 'int' },
])

const infoSections: InfoSection[] = [
  {
    title: 'Como funciona',
    content: [
      {
        type: 'text',
        value:
          'O kart é controlado por uma política neural treinada enquanto dirige. Sensores leem a pista, a velocidade e o próximo checkpoint; a rede transforma essas observações em aceleração e direção.',
      },
    ],
  },
  {
    title: 'O objetivo',
    content: [
      {
        type: 'steps',
        items: [
          'Avançar pela pista e atravessar os checkpoints na ordem correta',
          'Manter velocidade e alinhamento com o centro da pista',
          'Evitar sair do traçado ou ficar parado por muito tempo',
          'Completar voltas acumulando a maior recompensa possível',
        ],
      },
    ],
  },
  {
    title: 'PPO',
    content: [
      {
        type: 'text',
        value:
          'Proximal Policy Optimization atualiza a política em pequenos passos, limitando mudanças bruscas. Isso deixa o treinamento mais estável enquanto o agente explora diferentes formas de acelerar e esterçar.',
      },
      { type: 'formula', value: 'Lclip(θ) = min(r(θ) · A, clip(r(θ), 1 − ε, 1 + ε) · A)' },
    ],
  },
  {
    title: 'Observações e ações',
    content: [
      {
        type: 'numbered',
        items: [
          'Velocidade, alinhamento e posição lateral na pista',
          'Direção e distância até o próximo checkpoint',
          'Distâncias captadas pelos sensores ao redor do kart',
          'Duas ações contínuas: aceleração/freio e esterçamento',
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
          'O agente recebe recompensa por progresso, velocidade e bom alinhamento. Desvios laterais, baixa velocidade e tempo sem alcançar um checkpoint geram penalidades.',
      },
    ],
  },
]

const input = (index: number) => props.policyInputs[index] ?? 0
const output = (index: number) => props.policyOutputs[index] ?? 0
const sensorList = (values: number[]) => values.map((value) => value.toFixed(0)).join(', ')
</script>

<template>
  <simulation-panel
    :simulation="simulation"
    :stat-rows="statRows"
    :reward-history="metrics.history"
    chart-label="Recompensa por episódio"
    :info-sections="infoSections"
    default-tab="stats"
  >
    <template #params>
      <div class="flex flex-col divide-y divide-border/40">
        <section class="flex flex-col gap-4 px-4 py-4">
          <div class="flex items-center gap-1.5">
            <cpu class="h-3 w-3 text-muted-foreground/60" />
            <span class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Simulação
            </span>
          </div>
          <param-slider
            label="Velocidade"
            description="Passos processados a cada frame"
            :model-value="metrics.stepsPerFrame"
            :min="1"
            :max="100"
            :step="1"
            format="int"
            :log-scale="true"
            @update:model-value="emit('update:speed', $event)"
          />
          <param-slider
            label="Limite por checkpoint"
            description="Segundos antes de reiniciar o episódio"
            :model-value="checkpointLimit"
            :min="5"
            :max="60"
            :step="1"
            format="int"
            @update:model-value="emit('update:checkpointLimit', $event)"
          />
          <div class="flex flex-col gap-2">
            <span class="text-xs text-foreground">Pista</span>
            <div class="grid grid-cols-2 gap-2">
              <base-button
                v-for="type in ['circuit', 'oval', 'snake', 'crazy'] as const"
                :key="type"
                size="sm"
                :variant="trackType === type ? 'primary' : 'outline'"
                class="capitalize"
                @click="emit('update:trackType', type)"
              >
                {{ type }}
              </base-button>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-3 px-4 py-4">
          <div class="flex items-center gap-1.5">
            <database class="h-3 w-3 text-muted-foreground/60" />
            <span class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Modelo PPO
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <base-button class="col-span-2" size="sm" variant="outline" @click="emit('toggle-training')">
              {{ metrics.mode === 'evaluation' ? 'Voltar a treinar' : 'Testar política' }}
            </base-button>
            <base-button size="sm" @click="emit('save')">Salvar IA</base-button>
            <base-button size="sm" @click="emit('load')">Carregar IA</base-button>
            <base-button class="col-span-2" size="sm" variant="danger" @click="emit('clear')">
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
            <span class="text-xs text-muted-foreground">Saída aceleração</span>
            <span class="font-mono text-xs text-foreground">{{ output(0).toFixed(3) }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Saída direção</span>
            <span class="font-mono text-xs text-foreground">{{ output(1).toFixed(3) }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Comando aplicado</span>
            <span class="font-mono text-xs text-foreground">
              {{ appliedForward.toFixed(2) }} / {{ appliedSteer.toFixed(2) }}
            </span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Alinhamento</span>
            <span class="font-mono text-xs text-foreground">{{ input(7).toFixed(3) }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Posição lateral</span>
            <span class="font-mono text-xs text-foreground">{{ input(8).toFixed(3) }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-xs text-muted-foreground">Distância ao checkpoint</span>
            <span class="font-mono text-xs text-foreground">{{ input(11).toFixed(3) }}</span>
          </div>
        </div>
        <div class="mt-3 flex flex-col gap-2 font-mono text-[9px] text-muted-foreground">
          <p>sensores frontais [{{ sensorList(frontSensors) }}]</p>
          <p>sensores traseiros [{{ sensorList(rearSensors) }}]</p>
        </div>
      </section>
    </template>
  </simulation-panel>
</template>
