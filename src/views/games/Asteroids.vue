<script setup lang="ts">
import { Graphics, type Ticker } from 'pixi.js'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Pause, Play, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import AsteroidsPanel from '@/features/pixijs/asteroids/ui/AsteroidsPanel.vue'
import {
  ASTEROIDS_WORLD,
  AsteroidsPPOEnvironment,
  type AsteroidsSnapshot,
} from '@/features/pixijs/asteroids/ai/asteroids-env'
import { useTheme } from '@/shared/lib/theme/useTheme'
import { initPixi, pixiApp, releasePixi } from '@/shared/pixijs/pixi-app'

defineOptions({ name: 'NeuralAsteroids' })

const container = ref<HTMLDivElement | null>(null)
const checkpointInput = ref<HTMLInputElement | null>(null)
const ready = ref(false)
const paused = ref(false)
const speed = ref(1)
const viewMode = ref<'all' | 'best' | number>('best')
const checkpointStatus = ref('Auto-load: /models/asteroids.nnw')
const metrics = reactive({
  episodes: 0,
  reward: 0,
  bestReward: 0,
  score: 0,
  bestScore: 0,
  survival: 0,
  wave: 1,
  bestWave: 1,
  rewardHistory: [] as number[],
})

const { theme } = useTheme()
const env = new AsteroidsPPOEnvironment()
let graphics: Graphics | null = null
let tick: ((ticker: Ticker) => void) | null = null

const palette = computed(() =>
  theme.value === 'dark'
    ? { background: 0x18202f, foreground: 0xf2f5f7 }
    : { background: 0xf2f5f7, foreground: 0x18202f },
)
const viewLabel = computed(() =>
  viewMode.value === 'all'
    ? 'líder'
    : viewMode.value === 'best'
      ? 'melhor'
      : `nave ${viewMode.value + 1}`,
)

function focusedShip() {
  const snapshots = env.snapshots()
  if (viewMode.value === 'all' || viewMode.value === 'best') return env.leader()
  return snapshots.find((ship) => ship.index === viewMode.value) ?? env.leader()
}

function syncMetrics() {
  const ship = focusedShip()
  metrics.episodes = env.episodes
  metrics.reward = ship.episodeReward
  metrics.bestReward = Number.isFinite(env.bestReward) ? env.bestReward : 0
  metrics.score = ship.score
  metrics.bestScore = env.bestScore
  metrics.survival = ship.survival
  metrics.wave = ship.wave
  metrics.bestWave = env.bestWave
  metrics.rewardHistory = env.rewardHistory
}

function drawShip(g: Graphics, ship: AsteroidsSnapshot, sx: number, sy: number, alpha: number) {
  const scale = Math.min(sx, sy)
  const x = ship.x * sx
  const y = ship.y * sy
  const radius = ASTEROIDS_WORLD.shipRadius * scale
  const cos = Math.cos(ship.angle)
  const sin = Math.sin(ship.angle)
  const point = (forward: number, side: number): [number, number] => [
    x + (cos * forward - sin * side) * radius,
    y + (sin * forward + cos * side) * radius,
  ]
  const color = palette.value.foreground
  const nose = point(1.55, 0)
  const shoulderLeft = point(0.2, 0.48)
  const wingLeft = point(-0.95, 1.12)
  const engineLeft = point(-0.7, 0.35)
  const engineRight = point(-0.7, -0.35)
  const wingRight = point(-0.95, -1.12)
  const shoulderRight = point(0.2, -0.48)
  const hull = [
    ...nose,
    ...shoulderLeft,
    ...wingLeft,
    ...engineLeft,
    ...engineRight,
    ...wingRight,
    ...shoulderRight,
  ]
  g.poly(hull, true)
    .fill({ color, alpha: alpha * 0.1 })
    .stroke({
      color,
      width: Math.max(1.5, 1.8 * scale),
      alpha,
    })

  const spineFront = point(0.8, 0)
  const spineBack = point(-0.55, 0)
  g.moveTo(...spineFront)
    .lineTo(...spineBack)
    .stroke({
      color,
      width: Math.max(1, scale),
      alpha: alpha * 0.7,
    })
  const cockpit = point(0.35, 0)
  g.circle(cockpit[0], cockpit[1], radius * 0.24)
    .fill({
      color,
      alpha: alpha * 0.22,
    })
    .stroke({ color, width: Math.max(1, scale), alpha })

  const nozzleLeft = point(-0.72, 0.22)
  const nozzleRight = point(-0.72, -0.22)
  g.circle(nozzleLeft[0], nozzleLeft[1], radius * 0.09).fill({ color, alpha })
  g.circle(nozzleRight[0], nozzleRight[1], radius * 0.09).fill({ color, alpha })
  if (ship.thrusting) {
    const flameLength = 1.3 + Math.random() * 0.4
    const flameLeft = point(-flameLength, 0.22)
    const flameRight = point(-flameLength, -0.22)
    g.moveTo(...nozzleLeft)
      .lineTo(...flameLeft)
      .stroke({
        color,
        width: Math.max(1, 1.3 * scale),
        alpha: alpha * 0.8,
      })
    g.moveTo(...nozzleRight)
      .lineTo(...flameRight)
      .stroke({
        color,
        width: Math.max(1, 1.3 * scale),
        alpha: alpha * 0.8,
      })
  }
  if (ship.firing) {
    const muzzle = point(1.9, 0)
    g.moveTo(...nose)
      .lineTo(...muzzle)
      .stroke({
        color,
        width: Math.max(1.5, 2 * scale),
        alpha,
      })
  }
}

function renderScene() {
  if (!graphics) return
  const g = graphics
  const { width, height } = pixiApp.screen
  const sx = width / ASTEROIDS_WORLD.width
  const sy = height / ASTEROIDS_WORLD.height
  const colors = palette.value
  g.clear()
  pixiApp.renderer.background.color = colors.background

  const grid = 50 * Math.min(sx, sy)
  for (let x = 0; x <= width; x += grid) g.moveTo(x, 0).lineTo(x, height)
  for (let y = 0; y <= height; y += grid) g.moveTo(0, y).lineTo(width, y)
  g.stroke({ color: colors.foreground, width: 1, alpha: 0.045 })

  const snapshots = env.snapshots()
  const leader = env.leader()
  const visible =
    viewMode.value === 'all'
      ? snapshots
      : viewMode.value === 'best'
        ? [leader]
        : snapshots.filter((ship) => ship.index === viewMode.value)

  for (const ship of [...visible].sort((a, b) => a.opacity - b.opacity)) {
    const alpha = viewMode.value === 'all' ? 0.08 + ship.opacity * 0.32 : 0.82
    for (const asteroid of ship.asteroids) {
      const points: number[] = []
      asteroid.shape.forEach((factor, index) => {
        const angle = asteroid.angle + (index / asteroid.shape.length) * Math.PI * 2
        points.push(
          (asteroid.x + Math.cos(angle) * asteroid.radius * factor) * sx,
          (asteroid.y + Math.sin(angle) * asteroid.radius * factor) * sy,
        )
      })
      g.poly(points, true).stroke({ color: colors.foreground, width: 1.5, alpha })
    }
    for (const bullet of ship.bullets) {
      g.circle(bullet.x * sx, bullet.y * sy, 2.2 * Math.min(sx, sy)).fill({
        color: colors.foreground,
        alpha: Math.min(1, alpha + 0.2),
      })
    }
    drawShip(g, ship, sx, sy, viewMode.value === 'all' ? 0.3 + ship.opacity * 0.7 : 1)
  }

  const focus = focusedShip()
  const radarRadius = 23 * Math.min(sx, sy)
  g.circle(focus.x * sx, focus.y * sy, radarRadius).stroke({
    color: colors.foreground,
    width: 1,
    alpha: 0.18,
  })
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
    anchor.download = 'asteroids.nnw'
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
          v-for="index in ASTEROIDS_WORLD.numEnvs"
          :key="index"
          :variant="viewMode === index - 1 ? 'primary' : 'outline'"
          size="dot"
          @click="viewMode = index - 1"
        >
          Nave {{ index }}
        </base-button>
      </div>
      <div class="relative h-[60vh] min-h-105 overflow-hidden bg-background">
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
          <span>{{ viewLabel }} · {{ metrics.score }} asteroides</span>
          <span>onda {{ metrics.wave }}</span>
          <span>reward {{ metrics.reward.toFixed(2) }}</span>
          <span>{{ metrics.survival.toFixed(1) }}s</span>
        </div>
      </div>
    </div>

    <asteroids-panel
      :env-count="ASTEROIDS_WORLD.numEnvs"
      :episodes="metrics.episodes"
      :reward="metrics.reward"
      :best-reward="metrics.bestReward"
      :score="metrics.score"
      :best-score="metrics.bestScore"
      :survival="metrics.survival"
      :wave="metrics.wave"
      :best-wave="metrics.bestWave"
      :reward-history="metrics.rewardHistory"
      :speed="speed"
      :checkpoint-status="checkpointStatus"
      :view-label="viewLabel"
      @update:speed="speed = Math.max(1, Math.round($event))"
      @save="saveCheckpoint"
      @load="chooseCheckpoint"
      @reset="resetLearning"
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
