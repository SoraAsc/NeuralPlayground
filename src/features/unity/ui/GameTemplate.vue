<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { UnityConfig, UnityInstance } from '../model'

declare function createUnityInstance(
  canvas: HTMLCanvasElement | Element | null,
  config: UnityConfig,
  onProgress?: (progress: number) => void,
): Promise<UnityInstance>

const props = defineProps<{
  config: UnityConfig
  loaderUrl: string
}>()

let unityInstance: UnityInstance | null = null

function sendMessage(objectName: string, methodName: string, value?: string | number) {
  unityInstance?.SendMessage(objectName, methodName, value)
}

defineExpose({ sendMessage })

onMounted(() => {
  const canvas = document.querySelector('#unity-canvas')

  const script = document.createElement('script')
  script.src = props.loaderUrl

  script.onload = () => {
    createUnityInstance(canvas, props.config)
      .then((instance: UnityInstance) => {
        unityInstance = instance
        console.log('Loading Unity')
      })
      .catch((message: string) => {
        alert(message)
      })
  }

  document.body.appendChild(script)
})

onUnmounted(() => {
  unityInstance?.Quit()
})
</script>

<template>
  <canvas id="unity-canvas"></canvas>
</template>
