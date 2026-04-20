<script setup lang="ts">
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import { useNeuralSnake } from '@/features/unity/games/snake/use-neural-snake'
import GameTemplate from '@/features/unity/ui/GameTemplate.vue'
import { Plus, X, Brain, Play, RotateCcw, Pause } from '@lucide/vue'
import { ref } from 'vue'

const game = ref<InstanceType<typeof GameTemplate> | null>(null)
const {
  simulations,
  currentSimulationIndex,
  changeSelectedSimulation,
  createSimulation,
  removeSimulation,
  syncBackgroundColor,
} = useNeuralSnake(game)

const isTraining = ref(false)
const isTesting = ref(false)
</script>

<template>
  <main class="flex flex-col gap-6 px-4 py-6">
    <div class="border border-border bg-card">
      <div class="flex items-center gap-2 border-b border-border px-4 py-2 overflow-x-auto">
        <base-button
          :variant="currentSimulationIndex === -1 ? 'primary' : 'outline'"
          size="dot"
          show-dot
          @click="changeSelectedSimulation(-1)"
          :disabled="currentSimulationIndex === null"
        >
          All Sim
        </base-button>
        <base-button
          v-for="sim in simulations"
          :key="sim"
          :variant="currentSimulationIndex === sim ? 'primary' : 'outline'"
          size="dot"
          show-dot
          @click="changeSelectedSimulation(sim)"
        >
          Sim {{ sim + 1 }}
          <template #right>
            <x
              v-if="sim > 0"
              class="h-3 w-3 opacity-50 hover:opacity-100 ml-0.5"
              @click.stop="removeSimulation(sim)"
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
            @click="isTraining = !isTraining"
          >
            <component :is="isTraining ? Pause : Brain" />
          </base-button>

          <base-button
            :variant="isTesting ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            @click="isTesting = !isTesting"
          >
            <component :is="isTesting ? Pause : Play" />
          </base-button>

          <div class="h-px w-4 bg-border/50 my-1" />

          <base-button variant="outline" size="icon" class="rounded-lg">
            <rotate-ccw />
          </base-button>
        </div>
      </div>
    </div>
  </main>
</template>
