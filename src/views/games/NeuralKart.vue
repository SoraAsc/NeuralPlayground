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
  TrackRenderer,
  trackCollisionSystem,
  checkpointSystem,
  spawnKarts,
  sensorSystem,
} from '@/features/pixijs/neural-kart/track'
import { Transform, AI, Velocity, Input } from '@/features/pixijs/neural-kart/kart/traits'
import { Progress } from '@/features/pixijs/neural-kart/track/track-checkpoints'

const gameContainer = ref<HTMLDivElement | null>(null)
const cameraMode = ref<'full' | 'follow'>('follow')
const karts = ref<Entity[]>([])
const selectedKartIndex = ref(0)
const timeMultiplier = ref(1)
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
})

const activeKart = computed(() => karts.value[selectedKartIndex.value])

let collisionSystem: () => void
let cpSystem: (delta: number) => void
let aiUpdate: () => void
const sensors = ref<(() => void) | null>(null)

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
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao limpar IA'
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
    const generator = new CircuitTrackGenerator()
    const track = generator.generate(Math.random() * 1000)

    // 2. Render Track
    const renderer = new TrackRenderer(pixiApp.stage)
    renderer.render(track)

    // 3. Setup Systems
    collisionSystem = trackCollisionSystem(track)
    cpSystem = checkpointSystem(track)
    sensors.value = sensorSystem(track)
    aiUpdate = aiSystem(track)

    // 4. Spawn karts at spawn points
    // const playerKart = await spawnKart(0, 0, 0, 'sport', 'manual')
    const botKart = await spawnKart(0, 0, 0, 'compact', 'ai')
    // const botKart2 = await spawnKart(0, 0, 0, 'compact', 'ai')
    karts.value = [botKart]
    spawnKarts(track, karts.value)

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
  <main class="game-view">
    <div ref="gameContainer" class="pixi-container" />
    <div class="game-hud">
      <h1>Neural Kart</h1>
      <p>WASD: Drive | C: Camera | Tab: Switch Kart</p>
      <p>K: Sensors</p>
      <div class="info">
        <span>Mode: {{ cameraMode === 'full' ? 'Full Track' : 'Follow Kart' }}</span>
        <span v-if="karts.length > 0"> (Kart {{ selectedKartIndex + 1 }}/{{ karts.length }})</span>
      </div>

      <div class="controls mt-4">
        <label>Simulation Speed: {{ timeMultiplier }}x</label>
        <div class="flex gap-2">
          <button @click="timeMultiplier = 1" :class="{ active: timeMultiplier === 1 }">1x</button>
          <button @click="timeMultiplier = 2" :class="{ active: timeMultiplier === 2 }">2x</button>
          <button @click="timeMultiplier = 5" :class="{ active: timeMultiplier === 5 }">5x</button>
          <button @click="timeMultiplier = 10" :class="{ active: timeMultiplier === 10 }">
            10x
          </button>
          <button @click="timeMultiplier = 100" :class="{ active: timeMultiplier === 100 }">
            100x
          </button>
        </div>
      </div>
      <div class="controls checkpoint-controls mt-4">
        <button @click="saveCheckpoint">Salvar IA</button>
        <button @click="chooseCheckpoint">Carregar IA</button>
        <button @click="clearCheckpoint">Limpar IA</button>
        <input ref="checkpointInput" type="file" accept=".nnw,application/octet-stream" hidden @change="loadCheckpoint" />
        <small>{{ checkpointStatus }}</small>
      </div>
    </div>

    <!-- Inspection Panel -->
    <div v-if="activeKart" class="inspection-panel">
      <h3>Kart Inspection</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <label>Source</label>
          <span>{{ inspection.source }}</span>
        </div>
        <div class="stat-item">
          <label>Speed</label>
          <span>{{ Math.round(inspection.speed) }}</span>
        </div>
        <div class="stat-item">
          <label>Progress</label>
          <span>CP: {{ inspection.cp }} | Laps: {{ inspection.laps }}</span>
        </div>
        <div class="stat-item">
          <label>Timeout</label>
          <span :class="{ warning: inspection.time > 7 }">
            {{ inspection.time.toFixed(1) }}s / {{ inspection.maxTime }}s
          </span>
        </div>

        <div class="stat-item full">
          <label>AI Reward (Total)</label>
          <span class="reward">{{ inspection.reward.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.game-view {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #111;
}

.pixi-container {
  width: 100%;
  height: 100%;
}

.game-hud {
  position: absolute;
  top: 20px;
  left: 20px;
  color: white;
  pointer-events: none;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.game-hud h1 {
  margin: 0;
  font-size: 2rem;
}

.info {
  margin-top: 5px;
  font-size: 0.9rem;
  opacity: 0.8;
}

.mt-4 {
  margin-top: 1rem;
}

.flex {
  display: flex;
}

.gap-2 {
  gap: 0.5rem;
}

.controls button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 4px 12px;
  cursor: pointer;
  pointer-events: auto;
  border-radius: 4px;
}

.controls button.active {
  background: #4caf50;
  border-color: #4caf50;
}

.checkpoint-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.checkpoint-controls small {
  max-width: 280px;
  opacity: 0.75;
}

.inspection-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 280px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  color: white;
  font-family: monospace;
}

.inspection-panel h3 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  color: #4caf50;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-item label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 2px;
}

.stat-item span {
  font-size: 0.95rem;
}

.stat-item.full {
  grid-column: 1 / -1;
}

.reward {
  color: #ffeb3b;
  font-weight: bold;
}

.warning {
  color: #ff5252;
}
</style>
