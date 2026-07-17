<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, reactive } from 'vue'
import type { Entity } from 'koota'
import { initPixi, pixiApp } from '@/shared/pixijs/pixi-app'
import { startGameLoop } from '@/shared/ecs/timer'
import {
  inputSystem,
  movementSystem,
  renderSystem,
  cleanupSystem,
} from '@/features/pixijs/neural-kart/kart/systems'
import { aiSystem } from '@/features/pixijs/neural-kart/ai/system'
import { NeuralKartEnvironment } from '@/features/pixijs/neural-kart/ai/neural-env'
import { spawnKart } from '@/features/pixijs/neural-kart/kart/kart'
import {
  CircuitTrackGenerator,
  CrazyTrackGenerator,
  OvalTrackGenerator,
  SnakeTrackGenerator,
  TrackRenderer,
  trackCollisionSystem,
  checkpointSystem,
  spawnKarts,
  sensorSystem,
} from '@/features/pixijs/neural-kart/track'
import { Transform, AI, Velocity, Input } from '@/features/pixijs/neural-kart/kart/traits'
import { Progress } from '@/features/pixijs/neural-kart/track/track-checkpoints'
import KartPanel from '@/features/pixijs/neural-kart/ui/KartPanel.vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import { Camera, Focus, ScanLine } from '@lucide/vue'
import type { TrackGenerator } from '@/features/pixijs/neural-kart/track'

const gameContainer = ref<HTMLDivElement | null>(null)
const cameraMode = ref<'full' | 'follow'>('follow')
const karts = ref<Entity[]>([])
const selectedKartIndex = ref(0)
const timeMultiplier = ref(1)
const trackType = ref<'circuit' | 'oval' | 'snake' | 'crazy'>('circuit')
const checkpointLimit = ref(20)
const checkpointStatus = ref('Auto-load: /models/neural-kart.nnw')
const checkpointInput = ref<HTMLInputElement | null>(null)

// Inspection State (Manual sync for reactivity)
const inspection = reactive({
  source: '',
  speed: 0,
  cp: 0,
  laps: 0,
  time: 0,
  maxTime: 10,
  reward: 0,
  episodes: 0,
  lastReward: 0,
  bestReward: 0,
  bestLaps: 0,
  rewardHistory: [] as number[],
})

const activeKart = computed(() => karts.value[selectedKartIndex.value])

let collisionSystem: () => void
let cpSystem: (delta: number) => void
let aiUpdate: () => void
let trackRenderer: TrackRenderer
const sensors = ref<(() => void) | null>(null)

const trackGenerators: Record<typeof trackType.value, () => TrackGenerator> = {
  circuit: () => new CircuitTrackGenerator(),
  oval: () => new OvalTrackGenerator(),
  snake: () => new SnakeTrackGenerator(),
  crazy: () => new CrazyTrackGenerator(),
}

function configureTrack() {
  const track = trackGenerators[trackType.value]().generate(Math.random() * 1000)
  trackRenderer.render(track)
  collisionSystem = trackCollisionSystem(track)
  cpSystem = checkpointSystem(track)
  sensors.value = sensorSystem(track)
  aiUpdate = aiSystem(track)
  spawnKarts(track, karts.value)
  for (const kart of karts.value) {
    const progress = kart.get(Progress)
    const velocity = kart.get(Velocity)
    const ai = kart.get(AI)
    if (progress) {
      progress.currentCheckpoint = 0
      progress.laps = 0
      progress.timeSinceLastCheckpoint = 0
      progress.timeSinceSpawn = 0
      progress.stationaryTime = 0
      progress.distanceToNext = Number.POSITIVE_INFINITY
      progress.lastDistanceToNext = Number.POSITIVE_INFINITY
      progress.maxTimePerCheckpoint = checkpointLimit.value
    }
    if (velocity) {
      velocity.x = 0
      velocity.y = 0
      velocity.speed = 0
    }
    ai?.env?.reset()
  }
  return track
}

function changeTrack(type: typeof trackType.value) {
  trackType.value = type
  configureTrack()
}

function setCheckpointLimit(value: number) {
  checkpointLimit.value = Math.round(value)
  for (const kart of karts.value) {
    const progress = kart.get(Progress)
    if (progress) progress.maxTimePerCheckpoint = checkpointLimit.value
  }
}

function toggleCamera() {
  cameraMode.value = cameraMode.value === 'full' ? 'follow' : 'full'
}

function nextKart() {
  if (karts.value.length === 0) return
  selectedKartIndex.value = (selectedKartIndex.value + 1) % karts.value.length
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key.toLowerCase() === 'c') {
    toggleCamera()
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    nextKart()
  }
}

async function saveCheckpoint() {
  try {
    const buffer = await NeuralKartEnvironment.exportSharedCheckpoint()
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'neural-kart.nnw'
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
    await NeuralKartEnvironment.importSharedCheckpoint(await file.arrayBuffer())
    checkpointStatus.value = `Carregado: ${file.name}`
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao carregar checkpoint'
  } finally {
    input.value = ''
  }
}

async function clearCheckpoint() {
  try {
    await NeuralKartEnvironment.resetSharedFromScratch()
    checkpointStatus.value = 'IA reinicializada do zero'
  } catch (error) {
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao reiniciar IA'
  }
}

// Camera Pivot for smoothing
const cameraPivot = { x: 0, y: 0 }

function updateGameSystems(delta: number) {
  const steps = timeMultiplier.value
  for (let i = 0; i < steps; i++) {
    inputSystem()
    sensors.value?.()
    collisionSystem?.()
    cpSystem?.(delta)
    aiUpdate?.()
    movementSystem(delta)
    cleanupSystem()
  }

  renderSystem()

  // Sync Inspection Data
  if (activeKart.value) {
    const input = activeKart.value.get(Input)
    const vel = activeKart.value.get(Velocity)
    const prog = activeKart.value.get(Progress)
    const ai = activeKart.value.get(AI)

    inspection.source = input?.source ?? 'unknown'
    inspection.speed = vel?.speed ?? 0
    inspection.cp = prog?.currentCheckpoint ?? 0
    inspection.laps = prog?.laps ?? 0
    inspection.time = prog?.timeSinceLastCheckpoint ?? 0
    inspection.maxTime = prog?.maxTimePerCheckpoint ?? 10
    inspection.reward = ai?.env?.totalReward ?? 0
    inspection.episodes = ai?.env?.episodes ?? 0
    inspection.lastReward = ai?.env?.lastEpisodeReward ?? 0
    inspection.bestReward = Number.isFinite(ai?.env?.bestReward) ? (ai?.env?.bestReward ?? 0) : 0
    inspection.bestLaps = ai?.env?.bestLaps ?? 0
    inspection.rewardHistory = ai?.env?.rewardHistory ?? []
  }

  // Camera Logic
  if (cameraMode.value === 'follow' && activeKart.value) {
    if (activeKart.value.has(Transform)) {
      const transform = activeKart.value.get(Transform)
      if (transform) {
        // Smooth camera using lerp
        const lerpFactor = 0.1 // Adjust for more/less "laziness"
        cameraPivot.x += (transform.x - cameraPivot.x) * lerpFactor
        cameraPivot.y += (transform.y - cameraPivot.y) * lerpFactor

        pixiApp.stage.pivot.set(cameraPivot.x, cameraPivot.y)
        pixiApp.stage.position.set(pixiApp.screen.width / 2, pixiApp.screen.height / 2)
        pixiApp.stage.scale.set(1)
      }
    }
  } else {
    pixiApp.stage.pivot.set(0, 0)
    pixiApp.stage.position.set(pixiApp.screen.width / 2, pixiApp.screen.height / 2)
    pixiApp.stage.scale.set(0.3)
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  if (gameContainer.value) {
    await initPixi(gameContainer.value)

    // 1. Generate Track
    trackRenderer = new TrackRenderer(pixiApp.stage)

    // 3. Setup Systems
    // 3. Spawn karts
    // const playerKart = await spawnKart(0, 0, 0, 'sport', 'manual')
    const botKart = await spawnKart(0, 0, 0, 'compact', 'ai')
    const botKart2 = await spawnKart(0, 0, 0, 'sport', 'ai')
    karts.value = [botKart, botKart2]
    configureTrack()
    checkpointStatus.value = (await NeuralKartEnvironment.wasPublishedCheckpointLoaded())
      ? 'Modelo publicado carregado automaticamente'
      : 'Nenhum modelo publicado encontrado; treinando do zero'

    // 5. Start the Game Loop
    startGameLoop(updateGameSystems)

    console.log('Game Started!')
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  NeuralKartEnvironment.disposeShared()
  pixiApp.destroy(true, { children: true, texture: true })
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow border border-border bg-card">
      <div class="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
        <base-button variant="primary" size="dot" show-dot :active="!!activeKart">
          Kart {{ selectedKartIndex + 1 }}
        </base-button>
        <span class="ml-auto whitespace-nowrap text-[10px] text-muted-foreground/60">
          C troca câmera · Tab troca kart · K exibe sensores
        </span>
      </div>

      <div class="group relative h-[60vh] overflow-hidden bg-[#111]">
        <div ref="gameContainer" class="h-full w-full" />

        <div
          class="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-1.5 shadow-2xl backdrop-blur-md"
        >
          <base-button
            :variant="cameraMode === 'follow' ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            title="Seguir kart"
            @click="cameraMode = 'follow'"
          >
            <focus />
          </base-button>
          <base-button
            :variant="cameraMode === 'full' ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            title="Ver pista completa"
            @click="cameraMode = 'full'"
          >
            <camera />
          </base-button>
          <div class="my-1 h-px w-4 bg-border/50" />
          <base-button
            variant="outline"
            size="icon"
            class="rounded-lg"
            title="Próximo kart"
            @click="nextKart"
          >
            <scan-line />
          </base-button>
        </div>

        <div
          class="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 border border-white/10 bg-black/45 px-2.5 py-1.5 text-[10px] text-white/70 backdrop-blur-md"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          PPO treinando · {{ timeMultiplier }}x ·
          {{ cameraMode === 'full' ? 'pista completa' : 'seguindo kart' }}
        </div>
      </div>
    </div>

    <kart-panel
      :speed="timeMultiplier"
      :source="inspection.source"
      :kart-speed="inspection.speed"
      :checkpoint="inspection.cp"
      :laps="inspection.laps"
      :timeout="inspection.time"
      :max-timeout="inspection.maxTime"
      :reward="inspection.reward"
      :episodes="inspection.episodes"
      :last-reward="inspection.lastReward"
      :best-reward="inspection.bestReward"
      :best-laps="inspection.bestLaps"
      :reward-history="inspection.rewardHistory"
      :checkpoint-limit="checkpointLimit"
      :track-type="trackType"
      :checkpoint-status="checkpointStatus"
      @update:speed="timeMultiplier = Math.max(1, Math.round($event))"
      @update:checkpoint-limit="setCheckpointLimit"
      @update:track-type="changeTrack"
      @save="saveCheckpoint"
      @load="chooseCheckpoint"
      @clear="clearCheckpoint"
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
