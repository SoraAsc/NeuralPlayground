<script setup lang="ts">
import { computed } from 'vue'
import { Cpu, Database } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import SimulationPanel from '@/features/unity/ui/SimulationPanel.vue'
import type { InfoSection, StatRow } from '@/features/unity/ui/SimulationPanel.vue'

const props = defineProps<{
  speed: number
  source: string
  kartSpeed: number
  checkpoint: number
  laps: number
  timeout: number
  maxTimeout: number
  reward: number
  checkpointStatus: string
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
  save: []
  load: []
  clear: []
}>()

const simulation = computed(() => ({ status: 'training' as const }))
const statRows = computed<StatRow[]>(() => [
  { label: 'Controle', value: props.source || 'carregando', format: 'str' },
  { label: 'Velocidade do kart', value: props.kartSpeed, format: 'int' },
  { label: 'Checkpoint', value: props.checkpoint, format: 'int' },
  { label: 'Voltas', value: props.laps, format: 'int' },
  { label: 'Tempo sem progresso', value: props.timeout, format: 'float' },
  { label: 'Limite por checkpoint', value: props.maxTimeout, format: 'float' },
  { label: 'Recompensa acumulada', value: props.reward, format: 'float' },
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
</script>

<template>
  <simulation-panel
    :simulation="simulation"
    :stat-rows="statRows"
    :reward-history="[]"
    chart-label="Recompensa do episódio atual"
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
            :model-value="speed"
            :min="1"
            :max="100"
            :step="1"
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
            <base-button class="col-span-2" size="sm" variant="danger" @click="emit('clear')">
              Reiniciar aprendizado
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
