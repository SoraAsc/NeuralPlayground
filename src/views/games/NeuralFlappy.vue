<script setup lang="ts">
import { Graphics, type Ticker } from 'pixi.js'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Pause, Play, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import FlappyPanel from '@/features/pixijs/flappy-bird/ui/FlappyPanel.vue'
import { FLAPPY_WORLD, FlappyPPOEnvironment } from '@/features/pixijs/flappy-bird/ai/flappy-env'
import { useTheme } from '@/shared/lib/theme/useTheme'
import { initPixi, pixiApp, releasePixi } from '@/shared/pixijs/pixi-app'
import type { TrainingMetrics } from '@/features/game/model/training-metrics'

const container = ref<HTMLDivElement | null>(null)
const checkpointInput = ref<HTMLInputElement | null>(null)
const ready = ref(false)
const paused = ref(false)
const speed = ref(1)
const movingPipes = ref(false)
const pipeVerticalSpeed = ref(20)
const viewMode = ref<'all' | 'best' | number>('all')
const checkpointStatus = ref('Auto-load: /models/flappy-bird.nnw')
const metrics = reactive({
  episodes: 0,
  reward: 0,
  bestReward: 0,
  score: 0,
  bestScore: 0,
  survival: 0,
  scoreHistory: [] as number[],
})

const { theme } = useTheme()
const env = new FlappyPPOEnvironment()
let graphics: Graphics | null = null
let tick: ((ticker: Ticker) => void) | null = null

const palette = computed(() =>
  theme.value === 'dark'
    ? { background: 0x18202f, foreground: 0xf2f5f7 }
    : { background: 0xf2f5f7, foreground: 0x18202f },
)

const birdColors = [
  0xff5d73, 0xffa552, 0xffd166, 0x8bd450, 0x4dd6b8, 0x4cc9f0, 0x4895ef, 0x6c63ff, 0x9b5de5,
  0xd65db1, 0xf15bb5, 0xff7aa2,
]

const trainingMetrics = computed<TrainingMetrics>(() => ({
  episodes: metrics.episodes,
  currentResult: metrics.score,
  bestResult: metrics.bestScore,
  history: metrics.scoreHistory,
  mode: paused.value ? 'paused' : 'training',
  stepsPerFrame: speed.value,
}))

const viewLabel = computed(() =>
  viewMode.value === 'all'
    ? 'líder'
    : viewMode.value === 'best'
      ? 'melhor'
      : `bird ${viewMode.value + 1}`,
)

function focusedBird() {
  const snapshots = env.snapshots()
  if (viewMode.value === 'all' || viewMode.value === 'best') return env.leader()
  return snapshots.find((bird) => bird.index === viewMode.value) ?? env.leader()
}

function updatePipeMotion(enabled = movingPipes.value, verticalSpeed = pipeVerticalSpeed.value) {
  movingPipes.value = enabled
  pipeVerticalSpeed.value = Math.max(5, Math.min(45, Math.round(verticalSpeed)))
  env.setPipeMotion(movingPipes.value, pipeVerticalSpeed.value)
}

function syncMetrics() {
  const leader = focusedBird()
  metrics.episodes = env.episodes
  metrics.reward = leader.episodeReward
  metrics.bestReward = Number.isFinite(env.bestReward) ? env.bestReward : 0
  metrics.score = leader.score
  metrics.bestScore = env.bestScore
  metrics.survival = leader.survival
  metrics.scoreHistory = env.scoreHistory
}

function renderScene() {
  if (!graphics) return
  const g = graphics
  const { width, height } = pixiApp.screen
  const sx = width / FLAPPY_WORLD.width
  const sy = height / FLAPPY_WORLD.height
  const colors = palette.value
  g.clear()
  pixiApp.renderer.background.color = colors.background

  const grid = 40 * Math.min(sx, sy)
  for (let x = 0; x <= width; x += grid) g.moveTo(x, 0).lineTo(x, height)
  for (let y = 0; y <= height; y += grid) g.moveTo(0, y).lineTo(width, y)
  g.stroke({ color: colors.foreground, width: 1, alpha: 0.07 })

  const leader = env.leader()
  const pipeWidth = FLAPPY_WORLD.pipeWidth * sx
  const snapshots = env.snapshots()
  const visibleBirds =
    viewMode.value === 'all'
      ? snapshots
      : viewMode.value === 'best'
        ? [leader]
        : snapshots.filter((bird) => bird.index === viewMode.value)
  for (const bird of [...visibleBirds].sort((a, b) => a.opacity - b.opacity)) {
    const color = birdColors[bird.index % birdColors.length] ?? colors.foreground
    const pipeAlpha =
      viewMode.value === 'all'
        ? bird.index === leader.index
          ? 0.38
          : 0.08 + bird.opacity * 0.14
        : 0.48
    for (const pipe of bird.pipes) {
      const pipeX = pipe.x * sx
      if (pipeX > width || pipeX + pipeWidth < 0) continue
      const gapTop = (pipe.gapY - FLAPPY_WORLD.pipeGap / 2) * sy
      const gapBottom = (pipe.gapY + FLAPPY_WORLD.pipeGap / 2) * sy
      g.rect(pipeX, 0, pipeWidth, gapTop).fill({ color, alpha: pipeAlpha })
      g.rect(pipeX, gapBottom, pipeWidth, height - gapBottom).fill({ color, alpha: pipeAlpha })
      g.rect(pipeX - 5, gapTop - 11, pipeWidth + 10, 11).fill({
        color,
        alpha: Math.min(0.65, pipeAlpha + 0.12),
      })
      g.rect(pipeX - 5, gapBottom, pipeWidth + 10, 11).fill({
        color,
        alpha: Math.min(0.65, pipeAlpha + 0.12),
      })
    }
  }

  const birdX = FLAPPY_WORLD.birdX * sx
  for (const bird of visibleBirds) {
    const y = bird.y * sy
    const radius = 12 * Math.min(sx, sy)
    const color = birdColors[bird.index % birdColors.length] ?? 0xffffff
    const opacity = viewMode.value === 'all' ? bird.opacity : 1
    g.circle(birdX, y, radius).fill({ color, alpha: opacity })
    g.poly([
      birdX + radius * 0.8,
      y - radius * 0.45,
      birdX + radius * 1.65,
      y,
      birdX + radius * 0.8,
      y + radius * 0.45,
    ]).fill({ color, alpha: opacity })
    if (bird.index === leader.index || viewMode.value !== 'all') {
      g.circle(birdX, y, radius + 4).stroke({ color, width: 2, alpha: 0.9 })
    }
  }
}

function resetLearning() {
  try {
    env.resetLearning()
    syncMetrics()
    checkpointStatus.value = 'IA reinicializada do zero'
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao reiniciar IA'
  }
}

function saveCheckpoint() {
  try {
    const buffer = env.exportCheckpoint()
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'flappy-bird.nnw'
    anchor.click()
    URL.revokeObjectURL(url)
    checkpointStatus.value = 'Checkpoint salvo'
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao salvar checkpoint'
  }
}

function chooseCheckpoint() {
  checkpointInput.value?.click()
}

async function loadCheckpoint(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    env.importCheckpoint(await file.arrayBuffer())
    syncMetrics()
    checkpointStatus.value = `Carregado: ${file.name}`
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao carregar checkpoint'
  } finally {
    input.value = ''
  }
}

onMounted(async () => {
  if (!container.value) return
  await initPixi(container.value)
  graphics = new Graphics()
  pixiApp.stage.addChild(graphics)
  await env.init()
  checkpointStatus.value = env.autoLoadedCheckpoint
    ? 'Modelo publicado carregado automaticamente'
    : 'Nenhum modelo publicado encontrado; treinando do zero'
  ready.value = true
  tick = () => {
    if (!paused.value) {
      for (let i = 0; i < Math.round(speed.value); i++) env.tick()
      syncMetrics()
    }
    renderScene()
  }
  pixiApp.ticker.add(tick)
})

watch(theme, renderScene)
watch(viewMode, () => {
  if (ready.value) syncMetrics()
  renderScene()
})

onUnmounted(() => {
  if (tick) pixiApp.ticker.remove(tick)
  tick = null
  env.dispose()
  graphics?.destroy()
  graphics = null
  releasePixi()
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow border border-border bg-card">
      <div class="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
        <base-button
          :variant="viewMode === 'all' ? 'primary' : 'outline'"
          size="dot"
          @click="viewMode = 'all'"
        >
          Todos
        </base-button>
        <base-button
          :variant="viewMode === 'best' ? 'primary' : 'outline'"
          size="dot"
          show-dot
          :active="ready && !paused"
          @click="viewMode = 'best'"
        >
          Melhor
        </base-button>
        <base-button
          v-for="index in FLAPPY_WORLD.numEnvs"
          :key="index"
          :variant="viewMode === index - 1 ? 'primary' : 'outline'"
          size="dot"
          :style="{
            borderColor: `#${(birdColors[index - 1] ?? 0xffffff).toString(16).padStart(6, '0')}`,
          }"
          @click="viewMode = index - 1"
        >
          Bird {{ index }}
        </base-button>
      </div>
      <div class="relative h-[60vh] min-h-[420px] overflow-hidden bg-background">
        <div ref="container" class="h-full w-full" />
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
        </div>
        <div
          class="pointer-events-none absolute bottom-4 left-4 flex gap-4 border border-border/40 bg-background/55 px-3 py-2 font-mono text-[10px] text-foreground backdrop-blur-md"
        >
          <span>{{ viewLabel }} · {{ metrics.score }} canos</span>
          <span>reward {{ metrics.reward.toFixed(2) }}</span>
          <span>{{ metrics.survival.toFixed(1) }}s</span>
          <span v-if="movingPipes">canos {{ pipeVerticalSpeed }} u/s</span>
        </div>
      </div>
    </div>

    <flappy-panel
      :metrics="trainingMetrics"
      :env-count="FLAPPY_WORLD.numEnvs"
      :reward="metrics.reward"
      :best-reward="metrics.bestReward"
      :survival="metrics.survival"
      :checkpoint-status="checkpointStatus"
      :view-label="viewLabel"
      :moving-pipes="movingPipes"
      :pipe-vertical-speed="pipeVerticalSpeed"
      @update:speed="speed = Math.max(1, Math.round($event))"
      @save="saveCheckpoint"
      @load="chooseCheckpoint"
      @reset="resetLearning"
      @update:moving-pipes="updatePipeMotion($event)"
      @update:pipe-vertical-speed="updatePipeMotion(movingPipes, $event)"
    />
    <input
      ref="checkpointInput"
      type="file"
      accept=".nnw,application/octet-stream"
      hidden
      @change="loadCheckpoint"
    />
  </main>
</template>
