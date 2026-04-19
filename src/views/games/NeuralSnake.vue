<script setup lang="ts">
import { ref } from 'vue'
import GameTemplate from '@/features/unity/ui/GameTemplate.vue'

const game = ref<InstanceType<typeof GameTemplate>>()

function callUnity() {
  game.value?.sendMessage('WebInterfaceObject', 'StartTraining')
}
</script>
<template>
  <main>
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
    <button @click="callUnity">Start</button>
  </main>
</template>
