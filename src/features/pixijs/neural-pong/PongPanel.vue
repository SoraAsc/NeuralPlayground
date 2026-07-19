<script setup lang="ts">
import { computed } from 'vue'
import { Database, Gauge, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import SimulationPanel from '@/features/unity/ui/SimulationPanel.vue'
import type { InfoSection, StatRow } from '@/features/unity/ui/SimulationPanel.vue'

const props = defineProps<{
  episodes: number
  rallies: number
  bestRally: number
  leftScore: number
  rightScore: number
  epsilon: number
  training: boolean
  rallyHistory: number[]
  speed: number
  checkpointStatus: string
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  'update:training': [value: boolean]
  save: []
  load: []
  reset: []
}>()

const simulation = computed(() => ({
  status: props.training ? ('training' as const) : ('testing' as const),
}))
const statRows = computed<StatRow[]>(() => [
  { label: 'Episódios', value: props.episodes, format: 'int' },
  { label: 'Rally atual', value: props.rallies, format: 'int' },
  { label: 'Melhor rally', value: props.bestRally, format: 'int' },
  { label: 'Placar esquerdo', value: props.leftScore, format: 'int' },
  { label: 'Placar direito', value: props.rightScore, format: 'int' },
  { label: 'Exploração ε', value: props.epsilon, format: 'float3' },
  { label: 'Estados da Q-table', value: 396, format: 'int' },
  { label: 'Ações por estado', value: 3, format: 'int' },
])

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
    :reward-history="rallyHistory"
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
            :model-value="speed"
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
                :variant="training ? 'primary' : 'outline'"
                @click="emit('update:training', true)"
              >
                Treinar
              </base-button>
              <base-button
                size="sm"
                :variant="!training ? 'primary' : 'outline'"
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
  </simulation-panel>
</template>
