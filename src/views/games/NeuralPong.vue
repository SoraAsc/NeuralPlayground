<script setup lang="ts">
import { Graphics, type Ticker } from 'pixi.js'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Pause, Play, RotateCcw, ScanLine } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import PongPanel from '@/features/pixijs/neural-pong/PongPanel.vue'
import {
  NeuralPongEnvironment,
  type PongDiagnostics,
  type PongSnapshot,
} from '@/features/pixijs/neural-pong/pong-env'
import { useTheme } from '@/shared/lib/theme/useTheme'
import { initPixi, pixiApp, releasePixi } from '@/shared/pixijs/pixi-app'
import type { TrainingMetrics } from '@/features/game/model/training-metrics'

const container = ref<HTMLDivElement | null>(null)
const checkpointInput = ref<HTMLInputElement | null>(null)
const ready = ref(false)
const paused = ref(false)
const debugMode = ref(false)
const speed = ref(8)
const checkpointStatus = ref(`Auto-load: ${import.meta.env.BASE_URL}models/neural-pong.nqt`)
const metrics = reactive<PongSnapshot>({
  width: 800,
  height: 500,
  paddleWidth: 14,
  paddleHeight: 92,
  ballSize: 12,
  leftY: 204,
  rightY: 204,
  ballX: 394,
  ballY: 244,
  leftScore: 0,
  rightScore: 0,
  episodes: 0,
  rallies: 0,
  bestRally: 0,
  epsilon: 1,
  training: true,
  rallyHistory: [],
})
const diagnostics = reactive<PongDiagnostics>({
  left: {
    state: 0,
    action: 0,
    qValues: [0, 0, 0],
    xBin: 0,
    yBin: 0,
    verticalDirectionBin: 0,
    toward: false,
  },
  right: {
    state: 0,
    action: 0,
    qValues: [0, 0, 0],
    xBin: 0,
    yBin: 0,
    verticalDirectionBin: 0,
    toward: false,
  },
})

const { theme } = useTheme()
const palette = computed(() =>
  theme.value === 'dark'
    ? { background: 0x18202f, foreground: 0xf2f5f7 }
    : { background: 0xf2f5f7, foreground: 0x18202f },
)
const trainingMetrics = computed<TrainingMetrics>(() => ({
  episodes: metrics.episodes,
  currentResult: metrics.rallies,
  bestResult: metrics.bestRally,
  history: metrics.rallyHistory,
  mode: paused.value ? 'paused' : metrics.training ? 'training' : 'evaluation',
  stepsPerFrame: speed.value,
}))
let environment: NeuralPongEnvironment | null = null
let graphics: Graphics | null = null
let tick: ((ticker: Ticker) => void) | null = null

function syncMetrics() {
  if (!environment) return
  Object.assign(metrics, environment.snapshot())
  if (debugMode.value) Object.assign(diagnostics, environment.diagnostics())
}

function renderScene() {
  if (!graphics) return
  const g = graphics
  const { width, height } = pixiApp.screen
  const sx = width / metrics.width
  const sy = height / metrics.height
  const scale = Math.min(sx, sy)
  const colors = palette.value
  g.clear()
  pixiApp.renderer.background.color = colors.background

  const grid = 50 * scale
  for (let x = 0; x <= width; x += grid) g.moveTo(x, 0).lineTo(x, height)
  for (let y = 0; y <= height; y += grid) g.moveTo(0, y).lineTo(width, y)
  g.stroke({ color: colors.foreground, width: 1, alpha: 0.045 })

  const inset = 18 * scale
  g.rect(inset, inset, width - inset * 2, height - inset * 2).stroke({
    color: colors.foreground,
    width: Math.max(1, scale),
    alpha: 0.18,
  })
  const dashHeight = 13 * scale
  const dashGap = 11 * scale
  for (let y = inset; y < height - inset; y += dashHeight + dashGap) {
    g.rect(width / 2 - scale, y, 2 * scale, Math.min(dashHeight, height - inset - y)).fill({
      color: colors.foreground,
      alpha: 0.2,
    })
  }

  const leftX = 28 * sx
  const rightX = (metrics.width - 28 - metrics.paddleWidth) * sx
  const paddleWidth = Math.max(5, metrics.paddleWidth * sx)
  const paddleHeight = metrics.paddleHeight * sy
  g.rect(leftX, metrics.leftY * sy, paddleWidth, paddleHeight).fill({
    color: colors.foreground,
    alpha: 0.95,
  })
  g.rect(rightX, metrics.rightY * sy, paddleWidth, paddleHeight)
    .fill({ color: colors.foreground, alpha: 0.16 })
    .stroke({ color: colors.foreground, width: Math.max(1.5, 2 * scale), alpha: 0.95 })

  const ballX = (metrics.ballX + metrics.ballSize / 2) * sx
  const ballY = (metrics.ballY + metrics.ballSize / 2) * sy
  const ballRadius = Math.max(4, (metrics.ballSize / 2) * scale)
  g.circle(ballX, ballY, ballRadius).fill(colors.foreground)
  g.circle(ballX, ballY, ballRadius * 1.8).stroke({
    color: colors.foreground,
    width: Math.max(1, scale),
    alpha: 0.12,
  })

  if (debugMode.value) {
    const leftCenterX = leftX + paddleWidth / 2
    const rightCenterX = rightX + paddleWidth / 2
    const leftCenterY = (metrics.leftY + metrics.paddleHeight / 2) * sy
    const rightCenterY = (metrics.rightY + metrics.paddleHeight / 2) * sy
    g.moveTo(leftCenterX, leftCenterY).lineTo(ballX, ballY)
    g.moveTo(rightCenterX, rightCenterY).lineTo(ballX, ballY)
    g.stroke({ color: colors.foreground, width: 1, alpha: 0.22 })
    for (const x of [leftCenterX, rightCenterX]) {
      g.moveTo(x - 8 * scale, ballY).lineTo(x + 8 * scale, ballY)
      g.circle(x, ballY, 5 * scale)
    }
    g.stroke({ color: colors.foreground, width: 1.5, alpha: 0.55 })
  }
}

function setTraining(training: boolean) {
  paused.value = false
  environment?.setTraining(training)
  syncMetrics()
}

function toggleDebug() {
  debugMode.value = !debugMode.value
  syncMetrics()
  renderScene()
}

function resetLearning() {
  try {
    environment?.clear()
    syncMetrics()
    checkpointStatus.value = 'Q-table limpa; treinamento reiniciado'
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao reiniciar IA'
  }
}

function saveCheckpoint() {
  if (!environment) return
  try {
    const url = URL.createObjectURL(
      new Blob([environment.saveCheckpoint()], { type: 'application/octet-stream' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'neural-pong.nqt'
    anchor.click()
    URL.revokeObjectURL(url)
    checkpointStatus.value = 'Q-table salva'
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao salvar Q-table'
  }
}

function chooseCheckpoint() {
  checkpointInput.value?.click()
}

async function loadCheckpoint(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !environment) return
  try {
    environment.loadCheckpoint(await file.arrayBuffer())
    syncMetrics()
    checkpointStatus.value = `Carregada: ${file.name}`
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao carregar Q-table'
  } finally {
    input.value = ''
  }
}

onMounted(async () => {
  if (!container.value) return
  await initPixi(container.value)
  graphics = new Graphics()
  pixiApp.stage.addChild(graphics)
  try {
    environment = await NeuralPongEnvironment.create()
    syncMetrics()
    checkpointStatus.value = environment.autoLoadedCheckpoint
      ? 'Q-table publicada carregada automaticamente'
      : 'Nenhuma Q-table publicada encontrada; treinando do zero'
    ready.value = true
    tick = () => {
      if (!paused.value) {
        for (let i = 0; i < Math.round(speed.value); i++) environment?.step()
        syncMetrics()
      }
      renderScene()
    }
    pixiApp.ticker.add(tick)
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao iniciar Neural Pong'
  }
})

watch(theme, renderScene)

onUnmounted(() => {
  if (tick) pixiApp.ticker.remove(tick)
  tick = null
  environment?.dispose()
  environment = null
  graphics?.destroy()
  graphics = null
  releasePixi()
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow border border-border bg-card">
      <div class="flex items-center gap-2 border-b border-border px-4 py-2">
        <base-button variant="primary" size="dot" show-dot :active="ready && !paused">
          Q-Learning · Self-play
        </base-button>
        <span class="ml-auto font-mono text-[10px] text-muted-foreground/60">
          ε {{ metrics.epsilon.toFixed(3) }}
        </span>
      </div>

      <div class="relative h-[60vh] min-h-105 overflow-hidden bg-background">
        <div ref="container" class="h-full w-full" />
        <div
          class="pointer-events-none absolute left-1/2 top-7 flex -translate-x-1/2 items-center gap-6 font-mono text-4xl font-semibold tabular-nums text-foreground"
        >
          <span>{{ metrics.leftScore }}</span>
          <span class="text-sm text-muted-foreground/40">—</span>
          <span>{{ metrics.rightScore }}</span>
        </div>

        <div
          class="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col gap-2 rounded-xl border border-border/50 bg-background/55 p-1.5 shadow-2xl backdrop-blur-md"
        >
          <base-button
            :variant="paused ? 'outline' : 'primary'"
            size="icon"
            class="rounded-lg"
            :title="paused ? 'Continuar' : 'Pausar'"
            @click="paused = !paused"
          >
            <component :is="paused ? Play : Pause" />
          </base-button>
          <base-button
            variant="outline"
            size="icon"
            class="rounded-lg"
            title="Reiniciar aprendizado"
            @click="resetLearning"
          >
            <rotate-ccw />
          </base-button>
          <div class="my-1 h-px w-4 bg-border/50" />
          <base-button
            :variant="debugMode ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            :title="debugMode ? 'Ocultar diagnóstico' : 'Mostrar diagnóstico'"
            @click="toggleDebug"
          >
            <scan-line />
          </base-button>
        </div>

        <div
          class="pointer-events-none absolute bottom-4 left-4 flex gap-4 border border-border/40 bg-background/55 px-3 py-2 font-mono text-[10px] text-foreground backdrop-blur-md"
        >
          <span>rally {{ metrics.rallies }}</span>
          <span>recorde {{ metrics.bestRally }}</span>
          <span>episódio {{ metrics.episodes }}</span>
          <span>{{ metrics.training ? 'treinando' : 'avaliando' }}</span>
        </div>
      </div>
    </div>

    <pong-panel
      :metrics="trainingMetrics"
      :left-score="metrics.leftScore"
      :right-score="metrics.rightScore"
      :epsilon="metrics.epsilon"
      :checkpoint-status="checkpointStatus"
      :debug-mode="debugMode"
      :diagnostics="diagnostics"
      @update:speed="speed = Math.max(1, Math.round($event))"
      @update:training="setTraining"
      @save="saveCheckpoint"
      @load="chooseCheckpoint"
      @reset="resetLearning"
    />
    <input
      ref="checkpointInput"
      type="file"
      accept=".nqt,application/octet-stream"
      hidden
      @change="loadCheckpoint"
    />
  </main>
</template>
