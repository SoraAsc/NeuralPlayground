<script setup lang="ts">
import { useNeuralSnake } from '@/features/unity/games/snake/use-neural-snake'
import GameTemplate from '@/features/unity/ui/GameTemplate.vue'
import { ref } from 'vue'

const game = ref<InstanceType<typeof GameTemplate> | null>(null)
const { episodes, startTraining } = useNeuralSnake(game)
</script>
<template>
  <main>
    <header>Episodes: {{ episodes }}</header>
    <game-template
      ref="game"
      loader-url="/unity/neural-snake/NeuralSnake.loader.js"
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
    <button @click="startTraining">Start</button>
  </main>
</template>
