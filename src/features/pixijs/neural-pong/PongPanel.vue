<script setup lang="ts">
import { computed } from 'vue'
import { Database, Gauge, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import SimulationPanel from '@/features/unity/ui/SimulationPanel.vue'
import type { InfoSection, StatRow } from '@/features/unity/ui/SimulationPanel.vue'
import type { TrainingMetrics } from '@/features/game/model/training-metrics'
import type { PongAgentDebug, PongDiagnostics } from '@/features/pixijs/neural-pong/pong-env'

const props = defineProps<{
  metrics: TrainingMetrics
  leftScore: number
  rightScore: number
  epsilon: number
  checkpointStatus: string
  debugMode: boolean
  diagnostics: PongDiagnostics
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  'update:training': [value: boolean]
  save: []
  load: []
  reset: []
}>()

const simulation = computed(() => ({
  status:
    props.metrics.mode === 'paused'
      ? ('stopped' as const)
      : props.metrics.mode === 'training'
        ? ('training' as const)
        : ('testing' as const),
}))
const statRows = computed<StatRow[]>(() => [
  { label: 'Episódios', value: props.metrics.episodes, format: 'int' },
  { label: 'Rally atual', value: props.metrics.currentResult, format: 'int' },
  { label: 'Melhor rally', value: props.metrics.bestResult, format: 'int' },
  { label: 'Placar esquerdo', value: props.leftScore, format: 'int' },
  { label: 'Placar direito', value: props.rightScore, format: 'int' },
  { label: 'Exploração ε', value: props.epsilon, format: 'float3' },
  { label: 'Estados da Q-table', value: 396, format: 'int' },
  { label: 'Ações por estado', value: 3, format: 'int' },
])

function actionLabel(action: number) {
  return action === 1 ? 'subir' : action === 2 ? 'descer' : 'parado'
}

function directionLabel(bin: number) {
  return bin === 0 ? 'subindo' : bin === 2 ? 'descendo' : 'reta'
}

function qValues(debug: PongAgentDebug) {
  return debug.qValues.map((value) => value.toFixed(3)).join(', ')
}

const infoSections: InfoSection[] = [
  {
    title: 'Self-play simétrico',
    content: [
      {
        type: 'text',
        value:
          'As duas raquetes usam e atualizam a mesma Q-table. Para a raquete direita, o campo é espelhado; assim uma única política aprende a jogar nos dois lados.',
      },
    ],
  },
  {
    title: 'Estado e ações',
    content: [
      {
        type: 'steps',
        items: [
          'Distância horizontal da bola até a raquete',
          'Diferença vertical entre a bola e o centro da raquete',
          'Direção vertical e aproximação da bola',
          'Ações discretas: permanecer, subir ou descer',
        ],
      },
    ],
  },
  {
    title: 'Aprendizado',
    content: [
      {
        type: 'text',
        value:
          'Aproximar a raquete da bola produz um sinal pequeno. Rebater e marcar recompensa a política; deixar a bola passar gera penalidade. Avaliar desliga treino e exploração.',
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
    chart-label="Rallies por episódio"
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
            :max="128"
            format="int"
            :log-scale="true"
            @update:model-value="emit('update:speed', $event)"
          />
          <div class="flex flex-col gap-2">
            <span class="text-xs text-foreground">Modo da política</span>
            <div class="grid grid-cols-2 gap-2">
              <base-button
                size="sm"
                :variant="metrics.mode === 'training' ? 'primary' : 'outline'"
                @click="emit('update:training', true)"
              >
                Treinar
              </base-button>
              <base-button
                size="sm"
                :variant="metrics.mode === 'evaluation' ? 'primary' : 'outline'"
                @click="emit('update:training', false)"
              >
                Avaliar
              </base-button>
            </div>
          </div>
        </section>
        <section class="flex flex-col gap-3 px-4 py-4">
          <div class="flex items-center gap-1.5">
            <database class="h-3 w-3 text-muted-foreground/60" />
            <span class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Q-table
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
        <div class="flex flex-col gap-3">
          <div
            v-for="side in ['left', 'right'] as const"
            :key="side"
            class="border border-border/50 bg-background/30 p-3"
          >
            <div class="mb-2 flex items-center justify-between">
              <span class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {{ side === 'left' ? 'Raquete esquerda' : 'Raquete direita' }}
              </span>
              <span class="font-mono text-[10px] text-foreground">
                estado {{ diagnostics[side].state }}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <span class="text-muted-foreground">Ação</span>
              <span class="text-right font-mono text-foreground">{{ actionLabel(diagnostics[side].action) }}</span>
              <span class="text-muted-foreground">Bins x / y</span>
              <span class="text-right font-mono text-foreground">{{ diagnostics[side].xBin }} / {{ diagnostics[side].yBin }}</span>
              <span class="text-muted-foreground">Bola</span>
              <span class="text-right font-mono text-foreground">{{ directionLabel(diagnostics[side].verticalDirectionBin) }}</span>
              <span class="text-muted-foreground">Aproximando</span>
              <span class="text-right font-mono text-foreground">{{ diagnostics[side].toward ? 'sim' : 'não' }}</span>
            </div>
            <p class="mt-2 border-t border-border/40 pt-2 font-mono text-[9px] text-muted-foreground">
              Q [parado, subir, descer] = [{{ qValues(diagnostics[side]) }}]
            </p>
          </div>
        </div>
      </section>
    </template>
  </simulation-panel>
</template>
