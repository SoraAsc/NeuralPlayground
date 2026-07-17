<script setup lang="ts">
import { computed } from 'vue'
import { Database, Gauge, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import SimulationPanel from '@/features/unity/ui/SimulationPanel.vue'
import type { InfoSection, StatRow } from '@/features/unity/ui/SimulationPanel.vue'

const props = defineProps<{
  envCount: number
  episodes: number
  reward: number
  bestReward: number
  score: number
  bestScore: number
  survival: number
  rewardHistory: number[]
  speed: number
  checkpointStatus: string
  viewLabel: string
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  save: []
  load: []
  reset: []
}>()

const simulation = computed(() => ({ status: 'training' as const }))
const statRows = computed<StatRow[]>(() => [
  { label: 'Ambientes paralelos', value: props.envCount, format: 'int' },
  { label: 'Episódios', value: props.episodes, format: 'int' },
  { label: `Recompensa (${props.viewLabel})`, value: props.reward, format: 'float' },
  { label: 'Melhor recompensa', value: props.bestReward, format: 'float' },
  { label: `Canos (${props.viewLabel})`, value: props.score, format: 'int' },
  { label: 'Recorde de canos', value: props.bestScore, format: 'int' },
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
    :reward-history="rewardHistory"
    chart-label="Recompensa por episódio"
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
            :model-value="speed"
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
  </simulation-panel>
</template>
