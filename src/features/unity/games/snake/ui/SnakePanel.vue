<script setup lang="ts">
import { computed } from 'vue'
import type { StatRow, InfoSection } from '@/features/unity/ui/SimulationPanel.vue'
import SimulationPanel from '@/features/unity/ui/SimulationPanel.vue'
import type { SimulationI } from '../use-neural-snake'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import { Globe } from '@lucide/vue'
import type { TrainingMetrics } from '@/features/game/model/training-metrics'

const props = defineProps<{
  metrics: TrainingMetrics
  simulation?: SimulationI | null
}>()

const emit = defineEmits<{
  'update:speed': [value: number]
}>()

const statRows = computed<StatRow[]>(() => {
  const s = props.simulation
  return [
    { label: 'Episódios', value: props.metrics.episodes, format: 'int' },
    { label: 'Recompensa atual', value: props.metrics.currentResult, format: 'float' },
    { label: 'Melhor recompensa', value: props.metrics.bestResult, format: 'float' },
    { label: 'Tamanho atual', value: s?.bodySize ?? 0, format: 'int' },
    { label: 'Melhor tamanho', value: s?.bestBodySize ?? 0, format: 'int' },
    { label: 'Tempo real', value: s?.realTimeTrained ?? 0, format: 'time' },
    { label: 'Tempo acelerado', value: s?.acceleratedTimeTrained ?? 0, format: 'time' },
  ]
})

const panelSimulation = computed(() => ({
  status:
    props.metrics.mode === 'training'
      ? ('training' as const)
      : props.metrics.mode === 'evaluation'
        ? ('testing' as const)
        : ('stopped' as const),
}))

const infoSections: InfoSection[] = [
  {
    title: 'Como funciona',
    content: [
      {
        type: 'text',
        value:
          'A cobra é controlada por um agente de inteligência artificial que aprende sozinho a jogar. Não há regras programadas manualmente — o agente descobre as melhores estratégias através de tentativa e erro, recebendo recompensas ao comer e penalidades ao morrer.',
      },
    ],
  },
  {
    title: 'O Jogo',
    content: [
      {
        type: 'steps',
        items: [
          'A cobra se move em um grid e precisa comer alimentos para crescer',
          'Se bater nas paredes ou no próprio corpo, o episódio termina',
          'O agente observa o estado do jogo e decide uma direção a cada passo',
          'A cada episódio, o agente atualiza sua estratégia com base nas recompensas obtidas',
        ],
      },
    ],
  },
  {
    title: 'Q-Learning',
    content: [
      {
        type: 'text',
        value:
          'Q-Learning é um algoritmo de aprendizado por reforço que constrói uma tabela de valores (Q-table) mapeando cada par (estado, ação) para a recompensa futura esperada. O agente usa essa tabela para decidir qual ação tomar em cada situação.',
      },
      {
        type: 'formula',
        value: "Q(s,a) ← Q(s,a) + α · [r + γ · max Q(s',a') − Q(s,a)]",
      },
    ],
  },
  {
    title: 'Parâmetros',
    content: [
      {
        type: 'params',
        items: [
          {
            symbol: 'α',
            name: 'Learning Rate',
            description:
              'Controla o quanto o agente atualiza os valores Q a cada passo. Valores altos aprendem rápido mas podem oscilar; valores baixos são mais estáveis.',
          },
          {
            symbol: 'γ',
            name: 'Discount Factor',
            description:
              'Determina a importância de recompensas futuras. Próximo de 1, o agente planeja a longo prazo. Próximo de 0, foca apenas na recompensa imediata.',
          },
          {
            symbol: 'ε',
            name: 'Epsilon',
            description:
              'Probabilidade de tomar uma ação aleatória ao invés da melhor conhecida. Começa alto para explorar o ambiente e diminui gradualmente conforme o agente aprende.',
          },
        ],
      },
    ],
  },
  {
    title: 'Representação de Estado',
    content: [
      {
        type: 'text',
        value:
          'O agente observa: direção da comida (relativa à cabeça), presença de perigo nas direções adjacentes (frente, esquerda, direita) e direção atual da cobra. Esses dados formam o estado usado para consultar a Q-table.',
      },
    ],
  },
  {
    title: 'Ciclo de Treinamento',
    content: [
      {
        type: 'numbered',
        items: [
          'Observar o estado atual do jogo',
          'Escolher ação (aleatória com prob. ε, ou melhor ação da Q-table)',
          'Executar ação e observar recompensa e novo estado',
          'Atualizar Q-table usando a fórmula de Bellman',
          'Repetir até o episódio terminar, depois reduzir ε',
        ],
      },
    ],
  },
]
</script>

<template>
  <simulation-panel
    :simulation="panelSimulation"
    :stat-rows="statRows"
    :reward-history="metrics.history"
    chart-label="Recompensa por episódio"
    :info-sections="infoSections"
    default-tab="stats"
  >
    <template #params>
      <div class="flex flex-col divide-y divide-border/40">
        <section class="px-4 py-4 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <globe class="h-3 w-3 text-muted-foreground/60" />
              <span class="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                Globais
              </span>
            </div>
            <span class="text-[10px] text-muted-foreground/40">afeta todas as sims</span>
          </div>

          <param-slider
            label="Velocidade"
            description="Tick rate de todas as simulações"
            :model-value="metrics.stepsPerFrame"
            :min="1"
            :max="8000"
            :step="1"
            format="int"
            :log-scale="true"
            @update:model-value="emit('update:speed', $event)"
          />
        </section>
      </div>
    </template>
  </simulation-panel>
</template>
