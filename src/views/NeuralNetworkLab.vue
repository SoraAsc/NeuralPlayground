<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Pause, Play, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import DecisionBoundary from '@/features/neural-network/ui/DecisionBoundary.vue'
import NeuralNetworkPanel from '@/features/neural-network/ui/NeuralNetworkPanel.vue'
import {
  DATASETS,
  LogicGateLab,
  type DatasetId,
  type HiddenLayer,
} from '@/features/neural-network/model/logic-gate-lab'

const resolution = 35
const lab = new LogicGateLab()
const ready = ref(false)
const running = ref(false)
const epoch = ref(0)
const losses = ref<number[]>([])
const cells = ref<ReturnType<LogicGateLab['decisionGrid']>>([])
const predictions = ref<number[]>([])
const learningRate = ref(0.03)
const epochsPerFrame = ref(5)
const datasetId = ref<DatasetId>('xor')
const layers = ref<HiddenLayer[]>([{ id: 1, units: 8, activation: 'tanh' }])
let animationFrame = 0
let nextLayerId = 2

const dataset = computed(() => DATASETS[datasetId.value])
const accuracy = computed(() => {
  if (!dataset.value.points.length) return 0
  const correct = dataset.value.points.filter(
    (point, index) => Number((predictions.value[index] ?? 0) >= 0.5) === point.target,
  ).length
  return correct / dataset.value.points.length
})
function refreshSurface() {
  predictions.value = lab.predictions()
  cells.value = lab.decisionGrid(resolution)
}

function frame() {
  if (!running.value) return
  const batch = lab.train(epochsPerFrame.value)
  losses.value.push(...batch)
  epoch.value += batch.length
  if (losses.value.length > 2000) losses.value.splice(0, losses.value.length - 2000)
  refreshSurface()
  animationFrame = requestAnimationFrame(frame)
}

function toggleTraining() {
  running.value = !running.value
  if (running.value) animationFrame = requestAnimationFrame(frame)
  else cancelAnimationFrame(animationFrame)
}

function rebuild() {
  running.value = false
  cancelAnimationFrame(animationFrame)
  lab.rebuild(layers.value, learningRate.value, dataset.value)
  epoch.value = 0
  losses.value = []
  refreshSurface()
}

function selectDataset(id: DatasetId) {
  datasetId.value = id
  nextTick(rebuild)
}

function addLayer() {
  if (layers.value.length >= 3) return
  layers.value.push({ id: nextLayerId++, units: 4, activation: 'tanh' })
  rebuild()
}

function removeLayer(id: number) {
  if (layers.value.length === 1) return
  layers.value = layers.value.filter((layer) => layer.id !== id)
  rebuild()
}

function setUnits(id: number, units: number) {
  const layer = layers.value.find((item) => item.id === id)
  if (layer) layer.units = Math.max(2, Math.min(32, units))
  rebuild()
}

function setActivation(id: number, activation: HiddenLayer['activation']) {
  const layer = layers.value.find((item) => item.id === id)
  if (layer) layer.activation = activation
  rebuild()
}

function setLearningRate(value: number) {
  learningRate.value = value
  rebuild()
}

onMounted(async () => {
  await lab.init(layers.value, learningRate.value, dataset.value)
  refreshSurface()
  ready.value = true
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
  lab.dispose()
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow border border-border bg-card">
      <div
        class="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3"
      >
        <div>
          <h1 class="text-sm font-semibold tracking-tight">Portas lógicas</h1>
          <p class="mt-0.5 max-w-lg text-[10px] text-muted-foreground">{{ dataset.description }}</p>
        </div>
        <div class="flex border border-border bg-background p-1">
          <button
            v-for="gate in ['and', 'xor'] as const"
            :key="gate"
            class="min-w-16 px-4 py-1.5 font-mono text-[10px] uppercase transition-colors"
            :class="
              datasetId === gate
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="selectDataset(gate)"
          >
            {{ gate }}
          </button>
        </div>
      </div>

      <div
        v-if="!ready"
        class="grid h-[70vh] min-h-120 place-items-center bg-background font-mono text-xs text-muted-foreground"
      >
        Carregando NNW/WASM…
      </div>
      <div v-else class="relative h-[66vh] min-h-110 overflow-hidden bg-background">
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.035]"
          style="
            background-image:
              linear-gradient(currentColor 1px, transparent 1px),
              linear-gradient(90deg, currentColor 1px, transparent 1px);
            background-size: 32px 32px;
          "
        />
        <div class="grid h-full">
          <div class="relative grid min-h-0 place-items-center p-6">
            <div class="h-full max-h-[58vh] w-full max-w-[58vh]">
              <decision-boundary
                :cells="cells"
                :resolution="resolution"
                :predictions="predictions"
                :points="dataset.points"
                :dataset-name="dataset.shortName"
              />
            </div>
          </div>
        </div>

        <div
          class="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2 rounded-xl border border-border/50 bg-background/65 p-1.5 shadow-2xl backdrop-blur-md"
        >
          <base-button
            :variant="running ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            :title="running ? 'Pausar' : 'Treinar'"
            @click="toggleTraining"
            ><component :is="running ? Pause : Play"
          /></base-button>
          <base-button
            variant="outline"
            size="icon"
            class="rounded-lg"
            title="Reiniciar aprendizado"
            @click="rebuild"
            ><rotate-ccw
          /></base-button>
        </div>
      </div>
      <div
        class="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border bg-card px-5 py-2.5 font-mono text-[10px]"
      >
        <span class="text-muted-foreground"
          >Experiência
          <strong class="ml-1 font-medium text-foreground">{{ dataset.name }}</strong></span
        >
        <span class="text-muted-foreground"
          >Época <strong class="ml-1 font-medium text-foreground">{{ epoch }}</strong></span
        >
        <span class="text-muted-foreground"
          >Loss
          <strong class="ml-1 font-medium text-foreground">{{
            losses.at(-1)?.toFixed(4) ?? '—'
          }}</strong></span
        >
        <span class="text-muted-foreground"
          >Acerto
          <strong class="ml-1 font-medium text-foreground"
            >{{ Math.round(accuracy * 100) }}%</strong
          ></span
        >
      </div>
    </div>

    <neural-network-panel
      v-if="ready"
      :layers="layers"
      :learning-rate="learningRate"
      :epochs-per-frame="epochsPerFrame"
      :epoch="epoch"
      :loss="losses.at(-1)"
      :accuracy="accuracy"
      :running="running"
      :sample-count="dataset.points.length"
      @add-layer="addLayer"
      @remove-layer="removeLayer"
      @set-units="setUnits"
      @set-activation="setActivation"
      @update:learning-rate="setLearningRate"
      @update:epochs-per-frame="epochsPerFrame = $event"
      @reset="rebuild"
    />
  </main>
</template>
