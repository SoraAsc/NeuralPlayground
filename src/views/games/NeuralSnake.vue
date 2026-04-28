<script setup lang="ts">
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import SnakePanel from '@/features/unity/games/snake/ui/SnakePanel.vue'
import { useNeuralSnake } from '@/features/unity/games/snake/use-neural-snake'
import GameTemplate from '@/features/unity/ui/GameTemplate.vue'
import { Plus, X, Brain, Play, RotateCcw, Pause } from '@lucide/vue'
import { ref, computed } from 'vue'

const game = ref<InstanceType<typeof GameTemplate> | null>(null)
const {
  episodes,
  simulations,
  currentSimulationIndex,
  changeSelectedSimulation,
  createSimulation,
  removeSimulation,
  syncBackgroundColor,

  startTraining,
  startTesting,
  pauseSimulation,
  // resetSimulation,

  tickRate,
  setTickRate,
} = useNeuralSnake(game)

const currentSimulation = computed(() =>
  simulations.value.find((s) => s.index === currentSimulationIndex.value),
)

const targetSimulations = computed(() => {
  if (currentSimulationIndex.value === -1) return simulations.value
  return currentSimulation.value ? [currentSimulation.value] : []
})

const isTesting = computed(() => targetSimulations.value.some((s) => s.status === 'testing'))

const isAllTesting = computed(
  () =>
    targetSimulations.value.length > 0 &&
    targetSimulations.value.every((s) => s.status === 'testing'),
)

const isTraining = computed(() => targetSimulations.value.some((s) => s.status === 'training'))

const isAllTraining = computed(
  () =>
    targetSimulations.value.length > 0 &&
    targetSimulations.value.every((s) => s.status === 'training'),
)

// const globalStats = computed(() => {
//   if (currentSimulationIndex.value !== -1 || simulations.value.length === 0) return null

//   const count = simulations.value.length
//   return {
//     reward: simulations.value.reduce((acc, s) => acc + (s.reward || 0), 0) / count,
//     bodySize: simulations.value.reduce((acc, s) => acc + (s.bodySize || 0), 0) / count,
//     realTimeTrained:
//       simulations.value.reduce((acc, s) => acc + (s.realTimeTrained || 0), 0) / count,
//     acceleratedTimeTrained:
//       simulations.value.reduce((acc, s) => acc + (s.acceleratedTimeTrained || 0), 0) / count,
//     status: simulations.value.every((s) => s.status === 'stopped')
//       ? 'stopped'
//       : simulations.value.every((s) => s.status === 'training')
//         ? 'training'
//         : simulations.value.every((s) => s.status === 'testing')
//           ? 'testing'
//           : 'mixed',
//   }
// })
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow border border-border bg-card">
      <div class="flex items-center gap-2 border-b border-border px-4 py-2 overflow-x-auto">
        <base-button
          :variant="currentSimulationIndex === -1 ? 'primary' : 'outline'"
          size="dot"
          show-dot
          :active="isTraining || isTesting"
          @click="changeSelectedSimulation(-1)"
          :disabled="currentSimulationIndex === null"
        >
          All Sim
        </base-button>
        <base-button
          v-for="sim in simulations"
          :key="sim.index"
          :variant="currentSimulationIndex === sim.index ? 'primary' : 'outline'"
          size="dot"
          show-dot
          :active="sim.status != 'stopped'"
          @click="changeSelectedSimulation(sim.index)"
        >
          Sim {{ sim.index + 1 }}
          <template #right>
            <x
              v-if="sim.index > 0"
              class="h-3 w-3 opacity-50 hover:opacity-100 ml-0.5"
              @click.stop="removeSimulation(sim.index)"
            />
          </template>
        </base-button>
        <base-button
          variant="ghost"
          size="icon"
          @click="createSimulation"
          :disabled="currentSimulationIndex === null"
        >
          <plus />
        </base-button>
      </div>

      <div class="relative group">
        <game-template
          ref="game"
          class="w-full h-[60vh]"
          loader-url="/unity/neural-snake/NeuralSnake.loader.js"
          @ready="syncBackgroundColor"
          :config="{
            dataUrl: '/unity/neural-snake/NeuralSnake.data.br',
            frameworkUrl: '/unity/neural-snake/NeuralSnake.framework.js.br',
            codeUrl: '/unity/neural-snake/NeuralSnake.wasm.br',
            companyName: 'SoraAsc',
            productName: 'NeuralSnake',
            productVersion: '1.0',
            streamingAssetsUrl: '/unity/streaming-assets',
          }"
        />

        <div
          class="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-background/40 backdrop-blur-md p-1.5 border border-border/50 rounded-xl shadow-2xl transition-all duration-300"
        >
          <base-button
            :variant="isTraining ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            @click="isAllTraining ? pauseSimulation() : startTraining()"
            :disabled="currentSimulationIndex === null"
          >
            <component :is="isAllTraining ? Pause : Brain" />
          </base-button>

          <base-button
            :variant="isTesting ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            @click="isAllTesting ? pauseSimulation() : startTesting()"
            :disabled="currentSimulationIndex === null"
          >
            <component :is="isAllTesting ? Pause : Play" />
          </base-button>

          <div class="h-px w-4 bg-border/50 my-1" />

          <base-button
            variant="outline"
            size="icon"
            class="rounded-lg"
            :disabled="currentSimulationIndex === null"
          >
            <rotate-ccw />
          </base-button>
        </div>
      </div>
    </div>
    <snake-panel
      :simulation="currentSimulation ?? null"
      :reward-history="currentSimulation?.rewardHistory ?? []"
      :episode="episodes"
      v-model:speed="tickRate"
      @update:speed="setTickRate"
    />
  </main>
</template>
