<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Eraser, Pause, Play, RotateCcw } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import {
  SHAPES,
  SHAPE_INPUT_SIZE,
  ShapeClassifierLab,
} from '@/features/neural-network/model/shape-classifier'

const lab = new ShapeClassifierLab()
const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
const running = ref(false)
const drawing = ref(false)
const hasDrawing = ref(false)
const epoch = ref(0)
const loss = ref<number>()
const accuracy = ref(0)
const epochsPerFrame = ref(1)
const prediction = ref({ shape: '—', confidence: 0, scores: [0, 0, 0] })
const pixels = new Float32Array(SHAPE_INPUT_SIZE * SHAPE_INPUT_SIZE)
let animationFrame = 0
let lastPoint: { x: number; y: number } | null = null
let themeObserver: MutationObserver | null = null

function colors() {
  const style = getComputedStyle(document.documentElement)
  return {
    background: style.getPropertyValue('--background'),
    foreground: style.getPropertyValue('--foreground'),
    border: style.getPropertyValue('--border'),
  }
}

function render() {
  const context = canvas.value?.getContext('2d')
  if (!context || !canvas.value) return
  const palette = colors()
  const cell = canvas.value.width / SHAPE_INPUT_SIZE
  context.fillStyle = palette.background
  context.fillRect(0, 0, canvas.value.width, canvas.value.height)
  context.strokeStyle = palette.border
  context.lineWidth = 1
  for (let index = 1; index < SHAPE_INPUT_SIZE; index++) {
    context.beginPath()
    context.moveTo(index * cell, 0)
    context.lineTo(index * cell, canvas.value.height)
    context.moveTo(0, index * cell)
    context.lineTo(canvas.value.width, index * cell)
    context.stroke()
  }
  context.fillStyle = palette.foreground
  pixels.forEach((value, index) => {
    if (!value) return
    context.globalAlpha = value
    context.fillRect(
      (index % SHAPE_INPUT_SIZE) * cell,
      Math.floor(index / SHAPE_INPUT_SIZE) * cell,
      cell + 0.5,
      cell + 0.5,
    )
  })
  context.globalAlpha = 1
}

function paintPoint(x: number, y: number) {
  const radius = 1.05
  for (let row = Math.floor(y - radius); row <= Math.ceil(y + radius); row++)
    for (let column = Math.floor(x - radius); column <= Math.ceil(x + radius); column++) {
      if (row < 0 || row >= SHAPE_INPUT_SIZE || column < 0 || column >= SHAPE_INPUT_SIZE) continue
      const distance = Math.hypot(column - x, row - y)
      pixels[row * SHAPE_INPUT_SIZE + column] = Math.max(
        pixels[row * SHAPE_INPUT_SIZE + column]!,
        Math.max(0, Math.min(1, radius + 0.55 - distance)),
      )
    }
}

function pointerPosition(event: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * SHAPE_INPUT_SIZE,
    y: ((event.clientY - rect.top) / rect.height) * SHAPE_INPUT_SIZE,
  }
}

function paint(event: PointerEvent) {
  if (!drawing.value) return
  const point = pointerPosition(event)
  if (lastPoint) {
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y)
    const steps = Math.max(1, Math.ceil(distance * 2))
    for (let step = 0; step <= steps; step++) {
      const ratio = step / steps
      paintPoint(
        lastPoint.x + (point.x - lastPoint.x) * ratio,
        lastPoint.y + (point.y - lastPoint.y) * ratio,
      )
    }
  } else paintPoint(point.x, point.y)
  lastPoint = point
  hasDrawing.value = true
  prediction.value = lab.predict(pixels)
  render()
}

function startDrawing(event: PointerEvent) {
  drawing.value = true
  lastPoint = null
  canvas.value?.setPointerCapture(event.pointerId)
  paint(event)
}

function stopDrawing() {
  drawing.value = false
  lastPoint = null
}

function clearDrawing() {
  pixels.fill(0)
  hasDrawing.value = false
  prediction.value = { shape: '—', confidence: 0, scores: [0, 0, 0] }
  render()
}

function frame() {
  if (!running.value) return
  const losses = lab.train(epochsPerFrame.value)
  loss.value = losses.at(-1)
  epoch.value += losses.length
  if (epoch.value % 5 === 0) accuracy.value = lab.accuracy()
  if (hasDrawing.value) prediction.value = lab.predict(pixels)
  animationFrame = requestAnimationFrame(frame)
}

function toggleTraining() {
  running.value = !running.value
  if (running.value) animationFrame = requestAnimationFrame(frame)
  else cancelAnimationFrame(animationFrame)
}

function reset() {
  running.value = false
  cancelAnimationFrame(animationFrame)
  lab.reset()
  epoch.value = 0
  loss.value = undefined
  accuracy.value = lab.accuracy()
  if (hasDrawing.value) prediction.value = lab.predict(pixels)
}

onMounted(async () => {
  await lab.init()
  accuracy.value = lab.accuracy()
  ready.value = true
  render()
  themeObserver = new MutationObserver(render)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
  themeObserver?.disconnect()
  lab.dispose()
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow overflow-hidden border border-border bg-card">
      <header
        class="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-2.5"
      >
        <div>
          <h1 class="text-sm font-semibold">Classificador de Formas</h1>
          <p class="mt-0.5 text-[10px] text-muted-foreground">
            Desenhe um círculo, quadrado ou triângulo
          </p>
        </div>
        <div class="flex gap-2">
          <base-button variant="primary" size="dot" :disabled="!ready" @click="toggleTraining"
            ><component :is="running ? Pause : Play" />{{
              running ? 'Pausar' : 'Treinar'
            }}</base-button
          ><base-button size="icon" title="Limpar desenho" @click="clearDrawing"
            ><eraser
          /></base-button>
        </div>
      </header>
      <div
        v-if="!ready"
        class="grid min-h-120 place-items-center font-mono text-xs text-muted-foreground"
      >
        Preparando exemplos…
      </div>
      <div
        v-else
        class="grid min-h-130 place-items-center bg-background p-6 md:grid-cols-[minmax(280px,440px)_minmax(220px,1fr)] md:gap-10"
      >
        <canvas
          ref="canvas"
          width="384"
          height="384"
          class="aspect-square w-full max-w-110 touch-none border border-border bg-background"
          @pointerdown="startDrawing"
          @pointermove="paint"
          @pointerup="stopDrawing"
          @pointercancel="stopDrawing"
        />
        <section class="w-full max-w-sm py-6">
          <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            A rede reconheceu
          </p>
          <p class="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            {{ prediction.shape }}
          </p>
          <p class="mt-2 font-mono text-xs text-muted-foreground">
            {{ Math.round(prediction.confidence * 100) }}% confiança
          </p>
          <div class="mt-8 space-y-3">
            <div v-for="(shape, index) in SHAPES" :key="shape">
              <div class="mb-1 flex justify-between font-mono text-[10px]">
                <span>{{ shape }}</span
                ><span>{{ Math.round((prediction.scores[index] ?? 0) * 100) }}%</span>
              </div>
              <div class="h-1.5 bg-border">
                <div
                  class="h-full bg-foreground transition-all"
                  :style="{
                    width: `${Math.max(0, Math.min(100, (prediction.scores[index] ?? 0) * 100))}%`,
                  }"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <aside v-if="ready" class="h-fit w-85 min-w-80 grow border border-border bg-card lg:grow-0">
      <div class="border-b border-border p-5">
        <p class="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Treinamento
        </p>
        <h2 class="mt-1 text-lg font-semibold">Diagnóstico</h2>
      </div>
      <div class="grid grid-cols-2 divide-x divide-y divide-border border-b border-border">
        <div class="p-4">
          <p class="font-mono text-xl">{{ epoch }}</p>
          <p class="text-[9px] uppercase text-muted-foreground">Épocas</p>
        </div>
        <div class="p-4">
          <p class="font-mono text-xl">{{ loss?.toFixed(4) ?? '—' }}</p>
          <p class="text-[9px] uppercase text-muted-foreground">Loss</p>
        </div>
        <div class="p-4">
          <p class="font-mono text-xl">{{ Math.round(accuracy * 100) }}%</p>
          <p class="text-[9px] uppercase text-muted-foreground">Acurácia</p>
        </div>
        <div class="p-4">
          <p class="font-mono text-xl">480</p>
          <p class="text-[9px] uppercase text-muted-foreground">Exemplos</p>
        </div>
      </div>
      <div class="space-y-5 p-5">
        <param-slider
          label="Épocas por frame"
          :model-value="epochsPerFrame"
          :min="1"
          :max="5"
          format="int"
          @update:model-value="epochsPerFrame = Math.round($event)"
        />
        <div
          class="border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-muted-foreground"
        >
          <span class="text-foreground">16×16 pixels</span> → Dense 32 ReLU → Dense 16 ReLU →
          <span class="text-foreground">3 formas</span>
        </div>
        <p class="text-xs leading-relaxed text-muted-foreground">
          A rede treina com variações sintéticas de posição, tamanho, espessura e rotação. Seu
          desenho é reduzido para a mesma grade de 16×16.
        </p>
        <base-button class="w-full" variant="danger" size="sm" @click="reset"
          ><rotate-ccw /> Reiniciar pesos</base-button
        >
      </div>
    </aside>
  </main>
</template>
