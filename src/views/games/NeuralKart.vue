<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { initPixi, pixiApp } from '@/shared/pixijs/pixi-app'
import { startGameLoop } from '@/shared/ecs/timer'
import { inputSystem, movementSystem, renderSystem } from '@/features/kart/systems'
import { spawnKart } from '@/features/kart/kart'

const gameContainer = ref<HTMLDivElement | null>(null)

function updateGameSystems(delta: number) {
  inputSystem()
  movementSystem(delta)
  renderSystem()
}

onMounted(async () => {
  if (gameContainer.value) {
    await initPixi(gameContainer.value)

    // Spawn kart at center
    await spawnKart(pixiApp.screen.width / 2, pixiApp.screen.height / 2)

    // 2. Inicia o Game Loop (Koota ECS + Pixi Ticker)
    startGameLoop(updateGameSystems)

    console.log('🎮 Jogo inicializado com sucesso!')
  }
})

onUnmounted(() => pixiApp.destroy(true, { children: true, texture: true }))
</script>
<template>
  <main class="game-view">
    <div ref="gameContainer" class="pixi-container" />
    <div class="game-hud">
      <h1>Neural Kart</h1>
      <p>Use WASD to Drive</p>
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
</style>
