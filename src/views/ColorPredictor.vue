<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Pause, Play, RotateCcw, Shuffle } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import {
  ColorPredictorLab,
  colorFamily,
  hexToRgb,
  idealLightText,
  rgbToHex,
  type RGB,
} from '@/features/neural-network/model/color-predictor'

const lab = new ColorPredictorLab()
const ready = ref(false)
const running = ref(false)
const epoch = ref(0)
const losses = ref<number[]>([])
const accuracy = ref(0)
const epochsPerFrame = ref(2)
const selectedHex = ref('#6d28d9')
const predictedFamily = ref('Cinza')
const predictedConfidence = ref(0)
let animationFrame = 0

const color = computed(() => hexToRgb(selectedHex.value))
const idealIsLight = computed(() => idealLightText(color.value))
const expectedFamily = computed(() => colorFamily(color.value))
const predictionCorrect = computed(() => predictedFamily.value === expectedFamily.value)
const textColor = computed(() => (idealIsLight.value ? '#ffffff' : '#111111'))

const samples: RGB[] = [
  { r: 17, g: 24, b: 39 },
  { r: 248, g: 250, b: 252 },
  { r: 220, g: 38, b: 38 },
  { r: 250, g: 204, b: 21 },
  { r: 22, g: 163, b: 74 },
  { r: 37, g: 99, b: 235 },
  { r: 147, g: 51, b: 234 },
  { r: 236, g: 72, b: 153 },
]
const samplePredictions = ref<ReturnType<ColorPredictorLab['classify']>>([])

function refresh() {
  const current = lab.classify([color.value])[0]
  predictedFamily.value = current?.family ?? 'Cinza'
  predictedConfidence.value = current?.confidence ?? 0
  samplePredictions.value = lab.classify(samples)
}

function frame() {
  if (!running.value) return
  const batch = lab.train(epochsPerFrame.value)
  losses.value.push(...batch)
  epoch.value += batch.length
  if (epoch.value % 10 === 0) accuracy.value = lab.accuracy()
  refresh()
  animationFrame = requestAnimationFrame(frame)
}

function toggleTraining() {
  running.value = !running.value
  if (running.value) animationFrame = requestAnimationFrame(frame)
  else cancelAnimationFrame(animationFrame)
}

function reset() {
  running.value = false
  cancelAnimationFrame(animationFrame)
  lab.reset()
  epoch.value = 0
  losses.value = []
  accuracy.value = lab.accuracy()
  refresh()
}

function randomColor() {
  selectedHex.value = rgbToHex({
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  })
  refresh()
}

onMounted(async () => {
  await lab.init()
  accuracy.value = lab.accuracy()
  refresh()
  ready.value = true
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
  lab.dispose()
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow overflow-hidden border border-border bg-card">
      <header
        class="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-2.5"
      >
        <div>
          <h1 class="text-sm font-semibold tracking-tight">Color Predictor</h1>
          <p class="mt-0.5 text-[10px] text-muted-foreground">
            Reconhecimento de famílias de cor a partir de RGB
          </p>
        </div>
        <div class="flex items-center gap-2">
          <base-button variant="primary" size="dot" :disabled="!ready" @click="toggleTraining"
            ><component :is="running ? Pause : Play" />{{
              running ? 'Pausar' : 'Treinar'
            }}</base-button
          >
          <base-button size="icon" title="Reiniciar pesos" :disabled="!ready" @click="reset"
            ><rotate-ccw
          /></base-button>
        </div>
      </header>

      <div
        v-if="!ready"
        class="grid min-h-120 place-items-center font-mono text-xs text-muted-foreground"
      >
        Carregando rede neural…
      </div>
      <section v-else>
        <div
          class="relative grid min-h-105 place-items-center overflow-hidden transition-colors duration-300"
          :style="{ backgroundColor: selectedHex, color: textColor }"
        >
          <div class="text-center">
            <p class="font-mono text-xs uppercase tracking-[0.28em] opacity-70">
              A rede reconheceu
            </p>
            <p class="mt-3 text-5xl font-semibold tracking-tight md:text-7xl">
              {{ predictedFamily }}
            </p>
            <p class="mt-4 font-mono text-sm opacity-70">
              {{ selectedHex.toUpperCase() }} · {{ Math.round(predictedConfidence * 100) }}%
              confiança
            </p>
          </div>
          <div
            class="absolute bottom-4 right-4 flex items-center gap-2 rounded border border-current/20 bg-black/10 p-1.5 backdrop-blur-sm"
          >
            <label
              class="relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded border border-current/30"
              title="Escolher cor"
              ><input
                v-model="selectedHex"
                type="color"
                class="absolute -inset-2 h-14 w-14 cursor-pointer"
                @input="refresh"
            /></label>
            <base-button
              variant="outline"
              size="icon"
              class="border-current/30 bg-transparent text-current hover:border-current"
              title="Cor aleatória"
              @click="randomColor"
              ><shuffle
            /></base-button>
          </div>
        </div>

        <div class="border-t border-border p-4">
          <div class="mb-3 flex items-end justify-between">
            <div>
              <p class="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Teste rápido
              </p>
              <h2 class="mt-1 text-sm font-semibold">Paleta de validação</h2>
            </div>
            <span class="font-mono text-[10px] text-muted-foreground">clique para inspecionar</span>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="(sample, index) in samples"
              :key="rgbToHex(sample)"
              class="h-24 border border-border p-3 text-left transition-transform hover:-translate-y-0.5"
              :style="{
                backgroundColor: rgbToHex(sample),
                color: idealLightText(sample) ? '#fff' : '#111',
              }"
              @click="((selectedHex = rgbToHex(sample)), refresh())"
            >
              <span class="font-mono text-[9px] opacity-70">{{ rgbToHex(sample) }}</span
              ><span class="mt-5 block text-xs font-semibold">{{
                samplePredictions[index]?.family ?? '…'
              }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <aside v-if="ready" class="h-fit w-85 min-w-80 grow border border-border bg-card lg:grow-0">
      <div class="border-b border-border p-5">
        <p class="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Treinamento
        </p>
        <h2 class="mt-1 text-lg font-semibold">Diagnóstico</h2>
      </div>
      <div class="grid grid-cols-2 divide-x divide-y divide-border border-b border-border">
        <div class="p-4">
          <p class="font-mono text-xl">{{ epoch }}</p>
          <p class="text-[9px] uppercase text-muted-foreground">Épocas</p>
        </div>
        <div class="p-4">
          <p class="font-mono text-xl">{{ losses.at(-1)?.toFixed(4) ?? '—' }}</p>
          <p class="text-[9px] uppercase text-muted-foreground">Loss</p>
        </div>
        <div class="p-4">
          <p class="font-mono text-xl">{{ Math.round(accuracy * 100) }}%</p>
          <p class="text-[9px] uppercase text-muted-foreground">Acurácia</p>
        </div>
        <div class="p-4">
          <p class="font-mono text-xl" :class="predictionCorrect ? '' : 'text-destructive'">
            {{ predictionCorrect ? 'Correto' : 'Ajustando' }}
          </p>
          <p class="text-[9px] uppercase text-muted-foreground">Família atual</p>
        </div>
      </div>
      <div class="space-y-5 p-5">
        <param-slider
          label="Épocas por frame"
          description="Velocidade visual do treinamento"
          :model-value="epochsPerFrame"
          :min="1"
          :max="10"
          format="int"
          @update:model-value="epochsPerFrame = Math.round($event)"
        />
        <div
          class="border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-muted-foreground"
        >
          <span class="text-foreground">3 RGB</span> → Dense 16 tanh → Dense 12 tanh →
          <span class="text-foreground">11 categorias</span>
        </div>
        <p class="text-xs leading-relaxed text-muted-foreground">
          A rede distingue preto, branco, cinza e oito famílias cromáticas. O contraste do texto é
          calculado separadamente e permanece sempre legível.
        </p>
      </div>
    </aside>
  </main>
</template>
