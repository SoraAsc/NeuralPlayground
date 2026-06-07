<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import type { Entity } from 'koota'
import { initPixi, pixiApp } from '@/shared/pixijs/pixi-app'
import { startGameLoop } from '@/shared/ecs/timer'
import {
  inputSystem,
  movementSystem,
  renderSystem,
} from '@/features/pixijs/neural-kart/kart/systems'
import { spawnKart } from '@/features/pixijs/neural-kart/kart/kart'
import {
  CircuitTrackGenerator,
  TrackRenderer,
  trackCollisionSystem,
  checkpointSystem,
  spawnKarts,
} from '@/features/pixijs/neural-kart/track'
import { Transform } from '@/features/pixijs/neural-kart/kart/traits'

const gameContainer = ref<HTMLDivElement | null>(null)
const cameraMode = ref<'full' | 'follow'>('follow')
const karts = ref<Entity[]>([])
const selectedKartIndex = ref(0)

const activeKart = computed(() => karts.value[selectedKartIndex.value])

let collisionSystem: () => void
let cpSystem: () => void

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

// Camera Pivot for smoothing
const cameraPivot = { x: 0, y: 0 }

function updateGameSystems(delta: number) {
  inputSystem()
  movementSystem(delta)
  collisionSystem?.()
  cpSystem?.()
  renderSystem()

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

    // 4. Spawn karts at spawn points
    const playerKart = await spawnKart(0, 0, 0, 'sport')
    karts.value = [playerKart]
    // const botKart = await spawnKart(0, 0, 0, 'compact')
    // karts.value = [playerKart, botKart]
    spawnKarts(track, karts.value)

    // 5. Start the Game Loop
    startGameLoop(updateGameSystems)

    console.log('Game Started!')
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  pixiApp.destroy(true, { children: true, texture: true })
})
</script>

<template>
  <main class="game-view">
    <div ref="gameContainer" class="pixi-container" />
    <div class="game-hud">
      <h1>Neural Kart</h1>
      <p>WASD: Drive | C: Camera | Tab: Switch Kart</p>
      <div class="info">
        <span>Mode: {{ cameraMode === 'full' ? 'Full Track' : 'Follow Kart' }}</span>
        <span v-if="karts.length > 0"> (Kart {{ selectedKartIndex + 1 }}/{{ karts.length }})</span>
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
</style>
