<script setup lang="ts">
import { Application, Graphics } from 'pixi.js'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Pause, Play, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import PendulumPanel from '@/features/pixijs/inverted-pendulum/ui/PendulumPanel.vue'
import { PendulumEnvironment } from '@/features/pixijs/inverted-pendulum/ai/pendulum-env'
import { useTheme } from '@/shared/lib/theme/useTheme'

const container = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const paused = ref(false)
const speed = ref(1)
const checkpointInput = ref<HTMLInputElement | null>(null)
const checkpointStatus = ref('Auto-load: /models/inverted-pendulum.nnw')

const metrics = reactive({
  angle: 0,
  angularVelocity: 0,
  force: 0,
  cartPosition: 0,
  cartVelocity: 0,
  reward: 0,
  bestReward: 0,
  stability: 0,
  bestStability: 0,
  episodes: 0,
  rewardHistory: [] as number[],
})

const { theme } = useTheme()
const env = new PendulumEnvironment()
let app: Application | null = null
let graphics: Graphics | null = null

const palette = computed(() =>
  theme.value === 'dark'
    ? { background: 0x18202f, foreground: 0xf2f5f7 }
    : { background: 0xf2f5f7, foreground: 0x18202f },
)

function syncMetrics() {
  metrics.angle = env.theta
  metrics.angularVelocity = env.angularVelocity
  metrics.force = env.force
  metrics.cartPosition = env.cartPosition
  metrics.cartVelocity = env.cartVelocity
  metrics.reward = env.episodeReward
  metrics.bestReward = Number.isFinite(env.bestReward) ? env.bestReward : 0
  metrics.stability = env.stability
  metrics.bestStability = env.bestStability
  metrics.episodes = env.episodes
  metrics.rewardHistory = env.rewardHistory
}

function renderScene() {
  if (!app || !graphics) return
  const { width, height } = app.screen
  const colors = palette.value
  const g = graphics
  g.clear()
  app.renderer.background.color = colors.background

  const grid = Math.max(28, Math.min(width, height) / 14)
  for (let x = width / 2; x < width; x += grid) {
    g.moveTo(x, 0).lineTo(x, height)
  }
  for (let x = width / 2 - grid; x > 0; x -= grid) {
    g.moveTo(x, 0).lineTo(x, height)
  }
  for (let y = height * 0.72; y < height; y += grid) {
    g.moveTo(0, y).lineTo(width, y)
  }
  for (let y = height * 0.72 - grid; y > 0; y -= grid) {
    g.moveTo(0, y).lineTo(width, y)
  }
  g.stroke({ color: colors.foreground, width: 1, alpha: 0.08 })

  const trackHalfWidth = Math.min(width * 0.38, 340)
  const cartScale = trackHalfWidth / 2.4
  const pivotX = width / 2 + env.cartPosition * cartScale
  const pivotY = height * 0.72
  const rodLength = Math.min(height * 0.48, 240)
  const bobX = pivotX + Math.sin(env.theta) * rodLength
  const bobY = pivotY - Math.cos(env.theta) * rodLength

  // Geometric base and stability target.
  g.moveTo(width / 2 - trackHalfWidth, pivotY + 38).lineTo(width / 2 + trackHalfWidth, pivotY + 38)
  g.stroke({ color: colors.foreground, width: 4, alpha: 0.3 })
  g.rect(pivotX - 58, pivotY + 8, 116, 32).fill(colors.foreground)
  g.circle(pivotX - 36, pivotY + 42, 10)
    .fill(colors.background)
    .stroke({ color: colors.foreground, width: 4 })
  g.circle(pivotX + 36, pivotY + 42, 10)
    .fill(colors.background)
    .stroke({ color: colors.foreground, width: 4 })
  g.poly([pivotX - 36, pivotY + 8, pivotX + 36, pivotY + 8, pivotX, pivotY - 18]).fill({
    color: colors.foreground,
    alpha: 0.18,
  })
  g.moveTo(pivotX, pivotY).lineTo(pivotX, pivotY - rodLength - 28)
  g.stroke({ color: colors.foreground, width: 1, alpha: 0.16 })

  // Pendulum: rod, pivot and mass use only the foreground color.
  g.moveTo(pivotX, pivotY).lineTo(bobX, bobY)
  g.stroke({ color: colors.foreground, width: 8, cap: 'square' })
  g.circle(pivotX, pivotY, 13).fill(colors.background).stroke({
    color: colors.foreground,
    width: 5,
  })
  const bobSize = 22
  g.rect(bobX - bobSize / 2, bobY - bobSize / 2, bobSize, bobSize).fill(colors.foreground)

  // Horizontal force indicator; CartPole-v1 uses a magnitude of 10.
  const forceRatio = env.force / 10
  const forceWidth = forceRatio * 90
  g.moveTo(pivotX, pivotY + 68).lineTo(pivotX + forceWidth, pivotY + 68)
  g.stroke({ color: colors.foreground, width: 6, cap: 'square', alpha: 0.85 })
  if (Math.abs(forceWidth) > 4) {
    const direction = Math.sign(forceWidth)
    g.poly([
      pivotX + forceWidth,
      pivotY + 68,
      pivotX + forceWidth - direction * 10,
      pivotY + 61,
      pivotX + forceWidth - direction * 10,
      pivotY + 75,
    ]).fill(colors.foreground)
  }
}

function resetEpisode() {
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
    anchor.download = 'inverted-pendulum.nnw'
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
  app = new Application()
  await app.init({
    resizeTo: container.value,
    backgroundColor: palette.value.background,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })
  container.value.appendChild(app.canvas)
  graphics = new Graphics()
  app.stage.addChild(graphics)
  await env.init()
  checkpointStatus.value = env.autoLoadedCheckpoint
    ? 'Modelo publicado carregado automaticamente'
    : 'Nenhum modelo publicado encontrado; treinando do zero'
  ready.value = true

  app.ticker.add(() => {
    if (!paused.value) {
      for (let i = 0; i < Math.round(speed.value); i++) env.tick()
      syncMetrics()
    }
    renderScene()
  })
})

watch(theme, renderScene)

onUnmounted(() => {
  env.dispose()
  app?.destroy(true, { children: true, texture: true })
  app = null
  graphics = null
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow border border-border bg-card">
      <div class="flex items-center gap-2 border-b border-border px-4 py-2">
        <base-button variant="primary" size="dot" show-dot :active="ready && !paused">
          PPO · Pêndulo 01
        </base-button>
        <span class="ml-auto text-[10px] text-muted-foreground/60">
          CartPole-v1 · força contínua
        </span>
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
            @click="resetEpisode"
          >
            <rotate-ccw />
          </base-button>
        </div>

        <div
          class="pointer-events-none absolute bottom-4 left-4 flex gap-4 border border-border/40 bg-background/55 px-3 py-2 font-mono text-[10px] text-foreground backdrop-blur-md"
        >
          <span>θ {{ ((metrics.angle * 180) / Math.PI).toFixed(1) }}°</span>
          <span>F {{ metrics.force.toFixed(2) }}</span>
          <span>x {{ metrics.cartPosition.toFixed(2) }}</span>
          <span>estável {{ metrics.stability.toFixed(1) }}s</span>
        </div>
      </div>
    </div>

    <pendulum-panel
      :angle="metrics.angle"
      :force="metrics.force"
      :cart-position="metrics.cartPosition"
      :cart-velocity="metrics.cartVelocity"
      :reward="metrics.reward"
      :best-reward="metrics.bestReward"
      :stability="metrics.stability"
      :best-stability="metrics.bestStability"
      :angular-velocity="metrics.angularVelocity"
      :episodes="metrics.episodes"
      :reward-history="metrics.rewardHistory"
      :speed="speed"
      :checkpoint-status="checkpointStatus"
      @update:speed="speed = Math.max(1, Math.round($event))"
      @reset="resetEpisode"
      @save="saveCheckpoint"
      @load="chooseCheckpoint"
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
