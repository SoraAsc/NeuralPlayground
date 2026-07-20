<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus, RotateCcw, Trash2 } from '@lucide/vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import ParamSlider from '@/features/game/ui/ParamSlider.vue'
import type { HiddenLayer } from '@/features/neural-network/model/logic-gate-lab'

const props = defineProps<{
  layers: HiddenLayer[]
  learningRate: number
  epochsPerFrame: number
  epoch: number
  loss: number | undefined
  accuracy: number
  running: boolean
  sampleCount: number
}>()

const emit = defineEmits<{
  'add-layer': []
  'remove-layer': [id: number]
  'set-units': [id: number, units: number]
  'set-activation': [id: number, activation: HiddenLayer['activation']]
  'update:learning-rate': [value: number]
  'update:epochs-per-frame': [value: number]
  reset: []
}>()

const parameterCount = computed(() => {
  let inputs = 2
  let total = 0
  for (const layer of props.layers) {
    total += inputs * layer.units + layer.units
    inputs = layer.units
  }
  return total + inputs + 1
})

const activations: HiddenLayer['activation'][] = ['tanh', 'relu', 'sigmoid']
</script>

<template>
  <aside class="w-90 min-w-80 grow overflow-hidden border border-border bg-card xl:grow-0">
    <header class="border-b border-border px-5 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Construtor
          </p>
          <h2 class="mt-1 text-lg font-semibold">Arquitetura da rede</h2>
        </div>
        <span
          class="border border-border bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground"
          >{{ parameterCount }} params</span
        >
      </div>
      <div class="mt-4 flex items-center gap-1.5 overflow-hidden font-mono text-[10px]">
        <span class="rounded-full border border-border bg-background px-2.5 py-1.5">2</span>
        <template v-for="layer in layers" :key="layer.id">
          <span class="h-px min-w-2 flex-1 bg-border" />
          <span class="rounded-full border border-foreground/40 bg-background px-2.5 py-1.5">{{
            layer.units
          }}</span>
        </template>
        <span class="h-px min-w-2 flex-1 bg-border" />
        <span class="rounded-full bg-foreground px-2.5 py-1.5 text-background">1</span>
      </div>
    </header>

    <div class="max-h-[calc(80vh-80px)] overflow-y-auto">
      <section class="space-y-3 border-b border-border p-4">
        <article
          v-for="(layer, index) in layers"
          :key="layer.id"
          class="border border-border bg-background"
        >
          <div class="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div class="flex items-center gap-2">
              <span
                class="grid h-5 w-5 place-items-center rounded-full bg-accent font-mono text-xs text-accent-foreground"
                >{{ index + 1 }}</span
              ><span class="text-xs font-medium">Camada oculta</span>
            </div>
            <button
              :disabled="layers.length === 1"
              class="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-20"
              title="Remover camada"
              @click="emit('remove-layer', layer.id)"
            >
              <trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
          <div class="space-y-4 p-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs">Neurônios</p>
                <p class="text-[10px] text-muted-foreground">Capacidade desta camada</p>
              </div>
              <div class="flex items-center border border-border bg-card">
                <button
                  class="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground"
                  :disabled="layer.units <= 2"
                  @click="emit('set-units', layer.id, layer.units - 1)"
                >
                  <minus class="h-3 w-3" />
                </button>
                <span class="w-9 text-center font-mono text-xs">{{ layer.units }}</span>
                <button
                  class="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground"
                  :disabled="layer.units >= 32"
                  @click="emit('set-units', layer.id, layer.units + 1)"
                >
                  <plus class="h-3 w-3" />
                </button>
              </div>
            </div>
            <div>
              <p class="mb-2 text-xs">Função de ativação</p>
              <div class="grid grid-cols-3 gap-1">
                <button
                  v-for="activation in activations"
                  :key="activation"
                  class="border px-2 py-1.5 font-mono text-[10px] transition-colors"
                  :class="
                    layer.activation === activation
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  "
                  @click="emit('set-activation', layer.id, activation)"
                >
                  {{ activation }}
                </button>
              </div>
            </div>
          </div>
        </article>
        <button
          :disabled="layers.length >= 3"
          class="flex w-full items-center justify-center gap-2 border border-dashed border-border py-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-30"
          @click="emit('add-layer')"
        >
          <plus class="h-3.5 w-3.5" /> Adicionar camada oculta
        </button>
      </section>

      <section class="space-y-5 border-b border-border p-4">
        <div>
          <p class="text-xs font-medium">Treinamento</p>
          <p class="mt-0.5 text-[10px] text-muted-foreground">AdamW · Mean Squared Error</p>
        </div>
        <param-slider
          label="Learning rate"
          :model-value="learningRate"
          :min="0.001"
          :max="0.1"
          :step="0.001"
          format="float3"
          @update:model-value="emit('update:learning-rate', $event)"
        />
        <param-slider
          label="Épocas por frame"
          :model-value="epochsPerFrame"
          :min="1"
          :max="20"
          format="int"
          @update:model-value="emit('update:epochs-per-frame', Math.round($event))"
        />
      </section>

      <section class="p-4">
        <div
          class="grid grid-cols-4 divide-x divide-border border border-border bg-background text-center"
        >
          <div class="px-1 py-2">
            <p class="font-mono text-sm">{{ epoch }}</p>
            <p class="text-[8px] uppercase text-muted-foreground">Época</p>
          </div>
          <div class="px-1 py-2">
            <p class="font-mono text-sm">{{ loss?.toFixed(3) ?? '—' }}</p>
            <p class="text-[8px] uppercase text-muted-foreground">Loss</p>
          </div>
          <div class="px-1 py-2">
            <p class="font-mono text-sm">{{ Math.round(accuracy * 100) }}%</p>
            <p class="text-[8px] uppercase text-muted-foreground">Acerto</p>
          </div>
          <div class="px-1 py-2">
            <p class="font-mono text-sm">{{ sampleCount }}</p>
            <p class="text-[8px] uppercase text-muted-foreground">Pontos</p>
          </div>
        </div>
        <base-button class="mt-3 w-full" variant="danger" size="sm" @click="emit('reset')"
          ><rotate-ccw /> Reiniciar pesos</base-button
        >
      </section>
    </div>
  </aside>
</template>
