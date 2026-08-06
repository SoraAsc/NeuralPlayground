<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, reactive } from 'vue'
import type { Entity } from 'koota'
import { initPixi, pixiApp, releasePixi } from '@/shared/pixijs/pixi-app'
import { startGameLoop } from '@/shared/ecs/timer'
import {
  inputSystem,
  movementSystem,
  renderSystem,
  cleanupSystem,
  releaseKartRendering,
  resetKartInputKeys,
  setKartInputKey,
} from '@/features/pixijs/neural-kart/kart/systems'
import { aiSystem } from '@/features/pixijs/neural-kart/ai/system'
import { NeuralKartEnvironment } from '@/features/pixijs/neural-kart/ai/neural-env'
import { spawnKart } from '@/features/pixijs/neural-kart/kart/kart'
import {
  CircuitTrackGenerator,
  CrazyTrackGenerator,
  OvalTrackGenerator,
  SnakeTrackGenerator,
  TrackRenderer,
  trackCollisionSystem,
  checkpointSystem,
  spawnKarts,
  sensorSystem,
} from '@/features/pixijs/neural-kart/track'
import {
  Transform,
  AI,
  Velocity,
  Input,
  Sprite,
  AISensors,
} from '@/features/pixijs/neural-kart/kart/traits'
import { Progress } from '@/features/pixijs/neural-kart/track/track-checkpoints'
import KartPanel from '@/features/pixijs/neural-kart/ui/KartPanel.vue'
import BaseButton from '@/features/experiments/ui/BaseButton.vue'
import { Brain, Camera, Focus, Maximize2, Minimize2, ScanLine } from '@lucide/vue'
import type { TrackGenerator } from '@/features/pixijs/neural-kart/track'
import type { TrainingMetrics } from '@/features/game/model/training-metrics'
import { useCinematicDirector } from '@/features/game/model/use-cinematic-director'

const gameContainer = ref<HTMLDivElement | null>(null)
const cinematicStage = ref<HTMLDivElement | null>(null)
const isFullscreen = ref(false)
const cameraMode = ref<'full' | 'follow'>('follow')
const karts = ref<Entity[]>([])
const selectedKartIndex = ref(0)
const includePlayer = ref(false)
const timeMultiplier = ref(1)
const trackType = ref<'circuit' | 'oval' | 'snake' | 'crazy'>('circuit')
const checkpointLimit = ref(20)
const checkpointStatus = ref(`Auto-load: ${import.meta.env.BASE_URL}models/neural-kart.nnw`)
const checkpointInput = ref<HTMLInputElement | null>(null)
const ppoTraining = ref(true)
const debugMode = ref(false)

const inspection = reactive({
  source: '',
  speed: 0,
  cp: 0,
  laps: 0,
  time: 0,
  maxTime: 10,
  reward: 0,
  episodes: 0,
  lastReward: 0,
  bestReward: 0,
  bestLaps: 0,
  rewardHistory: [] as number[],
  policyInputs: [] as number[],
  policyOutputs: [] as number[],
  appliedForward: 0,
  appliedSteer: 0,
  frontSensors: [] as number[],
  rearSensors: [] as number[],
})

const trainingMetrics = computed<TrainingMetrics>(() => ({
  episodes: inspection.episodes,
  currentResult: inspection.reward,
  bestResult: inspection.bestReward,
  history: inspection.rewardHistory,
  mode: ppoTraining.value ? 'training' : 'evaluation',
  stepsPerFrame: timeMultiplier.value,
}))

const activeKart = computed(() => karts.value[selectedKartIndex.value])
const cinematicKartIndexes = computed(() =>
  karts.value.map((_, index) => index).filter((index) => includePlayer.value || index !== 1),
)
const cinematicDirector = useCinematicDirector(isFullscreen, {
  count: computed(() => cinematicKartIndexes.value.length + 1),
  intervalMs: 14000,
  onFocus: (index) => {
    if (index === 0) {
      cameraMode.value = 'full'
      const types = ['circuit', 'oval', 'snake', 'crazy'] as const
      const nextType = types[(types.indexOf(trackType.value) + 1) % types.length] ?? types[0]
      changeTrack(nextType)
    }
    else {
      cameraMode.value = 'follow'
      selectedKartIndex.value = cinematicKartIndexes.value[index - 1] ?? 0
    }
  },
})

let collisionSystem: () => void
let cpSystem: (delta: number) => void
let aiUpdate: () => void
let trackRenderer: TrackRenderer
let stopGameLoop: (() => void) | null = null
const sensors = ref<(() => void) | null>(null)

const trackGenerators: Record<typeof trackType.value, () => TrackGenerator> = {
  circuit: () => new CircuitTrackGenerator(),
  oval: () => new OvalTrackGenerator(),
  snake: () => new SnakeTrackGenerator(),
  crazy: () => new CrazyTrackGenerator(),
}

function configureTrack() {
  const track = trackGenerators[trackType.value]().generate(Math.random() * 1000)
  trackRenderer.render(track)
  collisionSystem = trackCollisionSystem(track)
  cpSystem = checkpointSystem(track)
  sensors.value = sensorSystem(track)
  aiUpdate = aiSystem(track)
  spawnKarts(track, karts.value)
  for (const kart of karts.value) {
    const progress = kart.get(Progress)
    const velocity = kart.get(Velocity)
    const ai = kart.get(AI)
    if (progress) {
      progress.currentCheckpoint = 0
      progress.laps = 0
      progress.timeSinceLastCheckpoint = 0
      progress.timeSinceSpawn = 0
      progress.stationaryTime = 0
      progress.distanceToNext = Number.POSITIVE_INFINITY
      progress.lastDistanceToNext = Number.POSITIVE_INFINITY
      progress.maxTimePerCheckpoint = checkpointLimit.value
    }
    if (velocity) {
      velocity.x = 0
      velocity.y = 0
      velocity.speed = 0
    }
    ai?.env?.reset()
  }
  return track
}

function changeTrack(type: typeof trackType.value) {
  trackType.value = type
  configureTrack()
}

function setCheckpointLimit(value: number) {
  checkpointLimit.value = Math.round(value)
  for (const kart of karts.value) {
    const progress = kart.get(Progress)
    if (progress) progress.maxTimePerCheckpoint = checkpointLimit.value
  }
}

function toggleCamera() {
  cameraMode.value = cameraMode.value === 'full' ? 'follow' : 'full'
}

function nextKart() {
  if (karts.value.length === 0) return
  selectedKartIndex.value = (selectedKartIndex.value + 1) % karts.value.length
  syncDiagnosticSensors()
}

function syncDiagnosticSensors() {
  karts.value.forEach((kart, index) => {
    const sensors = kart.get(AISensors)
    if (sensors) sensors.showVisuals = debugMode.value && index === selectedKartIndex.value
    const sprite = kart.get(Sprite)?.view
    if (sprite) sprite.visible = includePlayer.value || index !== 1
  })
}

function setIncludePlayer(value: boolean) {
  includePlayer.value = value
  if (!value && selectedKartIndex.value === 1) selectedKartIndex.value = 0
  syncDiagnosticSensors()
}

function toggleDiagnostics() {
  debugMode.value = !debugMode.value
  syncDiagnosticSensors()
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await cinematicStage.value?.requestFullscreen()
  } catch {
    checkpointStatus.value = 'O navegador não permitiu abrir a tela cheia'
  }
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === cinematicStage.value
  requestAnimationFrame(() => pixiApp.resize())
}

const checkpointProgress = computed(() =>
  Math.max(0, Math.min(100, (inspection.time / Math.max(inspection.maxTime, 0.01)) * 100)),
)

const speedPercent = computed(() => Math.max(0, Math.min(100, inspection.speed * 3.5)))

const steeringLabel = computed(() => {
  if (inspection.appliedSteer < -0.15) return 'ESQUERDA'
  if (inspection.appliedSteer > 0.15) return 'DIREITA'
  return 'CENTRO'
})

const handleKeyDown = (e: KeyboardEvent) => {
  setKartInputKey(e.key, true)
  if (e.key.toLowerCase() === 'c') {
    toggleCamera()
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    nextKart()
  }
  if (e.key.toLowerCase() === 'k') toggleDiagnostics()
  if (e.key.toLowerCase() === 'f') toggleFullscreen()
}

const handleKeyUp = (e: KeyboardEvent) => {
  setKartInputKey(e.key, false)
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
    checkpointStatus.value = error instanceof Error ? error.message : 'Falha ao reiniciar IA'
  }
}

async function togglePPOTraining() {
  ppoTraining.value = !ppoTraining.value
  await NeuralKartEnvironment.setSharedTraining(ppoTraining.value)
  checkpointStatus.value = ppoTraining.value
    ? 'Treinamento PPO retomado'
    : 'Modo de teste: política determinística e pesos bloqueados'
}

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

  if (activeKart.value) {
    const input = activeKart.value.get(Input)
    const vel = activeKart.value.get(Velocity)
    const prog = activeKart.value.get(Progress)
    const ai = activeKart.value.get(AI)
    const sensors = activeKart.value.get(AISensors)

    inspection.source = input?.source ?? 'unknown'
    inspection.speed = vel?.speed ?? 0
    inspection.cp = prog?.currentCheckpoint ?? 0
    inspection.laps = prog?.laps ?? 0
    inspection.time = prog?.timeSinceLastCheckpoint ?? 0
    inspection.maxTime = prog?.maxTimePerCheckpoint ?? 10
    inspection.reward = ai?.env?.totalReward ?? 0
    inspection.episodes = ai?.env?.episodes ?? 0
    inspection.lastReward = ai?.env?.lastEpisodeReward ?? 0
    inspection.bestReward = Number.isFinite(ai?.env?.bestReward) ? (ai?.env?.bestReward ?? 0) : 0
    inspection.bestLaps = ai?.env?.bestLaps ?? 0
    const rewardHistory = ai?.env?.rewardHistory ?? []
    if (
      inspection.rewardHistory.length !== rewardHistory.length ||
      inspection.rewardHistory.at(-1) !== rewardHistory.at(-1)
    )
      inspection.rewardHistory = [...rewardHistory]
    inspection.policyInputs = ai?.env?.inputs ?? []
    inspection.policyOutputs = ai?.env?.outputs ?? []
    inspection.appliedForward = input?.forward ?? 0
    inspection.appliedSteer = input?.steer ?? 0
    inspection.frontSensors = sensors?.distances ?? []
    inspection.rearSensors = sensors?.rearDistances ?? []
  }

  if (cameraMode.value === 'follow' && activeKart.value) {
    if (activeKart.value.has(Transform)) {
      const transform = activeKart.value.get(Transform)
      if (transform) {
        const lerpFactor = 0.1
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
  window.addEventListener('keyup', handleKeyUp)
  document.addEventListener('fullscreenchange', syncFullscreenState)
  if (gameContainer.value) {
    await initPixi(gameContainer.value)

    trackRenderer = new TrackRenderer(pixiApp.stage)

    const playerKart = await spawnKart(0, 0, 0, 'sport', 'manual')
    const botKart = await spawnKart(0, 0, 0, 'sport', 'ai')
    const botKart2 = await spawnKart(0, 0, 0, 'compact', 'ai')
    karts.value = [botKart, playerKart, botKart2]
    syncDiagnosticSensors()
    configureTrack()
    checkpointStatus.value = (await NeuralKartEnvironment.wasPublishedCheckpointLoaded())
      ? 'Modelo publicado carregado automaticamente'
      : 'Nenhum modelo publicado encontrado; treinando do zero'

    stopGameLoop = startGameLoop(updateGameSystems)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  resetKartInputKeys()
  stopGameLoop?.()
  stopGameLoop = null
  for (const kart of karts.value) {
    kart.get(AI)?.env?.dispose()
    kart.get(Sprite)?.view?.destroy({ children: true })
    kart.destroy()
  }
  karts.value = []
  trackRenderer?.destroy()
  releaseKartRendering()
  NeuralKartEnvironment.disposeShared()
  releasePixi()
})
</script>

<template>
  <main class="flex flex-wrap justify-center gap-6 px-4 py-6">
    <div class="w-2/3 grow border border-border bg-card">
      <div class="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
        <base-button variant="primary" size="dot" show-dot :active="!!activeKart">
          Kart {{ selectedKartIndex + 1 }}
        </base-button>
        <span class="ml-auto whitespace-nowrap text-[10px] text-muted-foreground/60">
          C troca câmera · Tab troca kart · K sensores · F tela cheia
        </span>
      </div>

      <div
        ref="cinematicStage"
        class="cinematic-stage group relative h-[60vh] overflow-hidden bg-[#080b0d]"
        :class="{ 'is-cinematic': isFullscreen }"
      >
        <div ref="gameContainer" class="h-full w-full" />

        <div v-if="isFullscreen" class="cinematic-vignette pointer-events-none absolute inset-0" />

        <div
          v-if="isFullscreen"
          class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-8 text-white"
        >
          <div>
            <p class="hud-kicker">NEURAL PLAYGROUND / LIVE</p>
            <h2 class="mt-1 text-2xl font-semibold tracking-tight">NEURAL KART</h2>
            <div
              class="mt-3 flex items-center gap-2 text-[11px] font-medium tracking-wider text-white/60"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              PPO {{ ppoTraining ? 'APRENDENDO' : 'EM AVALIAÇÃO' }}
              <span class="text-white/25">/</span>
              {{ trackType.toUpperCase() }}
            </div>
          </div>
          <div class="text-right">
            <p class="hud-kicker">MELHOR RESULTADO</p>
            <p class="mt-1 font-mono text-3xl font-light tabular-nums">
              {{ inspection.bestReward.toFixed(1) }}
            </p>
            <p class="mt-1 text-[10px] tracking-widest text-white/45">
              {{ inspection.episodes }} EPISÓDIOS · {{ inspection.bestLaps }} VOLTAS RECORDE
            </p>
          </div>
        </div>

        <div
          v-if="isFullscreen"
          class="cinematic-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-[1fr_auto_1fr] items-end gap-10 p-8 text-white"
        >
          <div class="max-w-sm">
            <div class="mb-2 flex items-end justify-between">
              <div>
                <p class="hud-kicker">TELEMETRIA</p>
                <p class="mt-1 hud-kicker">VELOCIDADE DO KART</p>
                <p class="mt-1 font-mono text-4xl font-light tabular-nums">
                  {{ inspection.speed.toFixed(0)
                  }}<span class="ml-1 text-sm text-white/45">U/S</span>
                </p>
              </div>
              <p class="font-mono text-xs text-white/55">{{ timeMultiplier }}× SIM</p>
            </div>
            <div class="h-1 overflow-hidden bg-white/15">
              <div
                class="h-full bg-amber-300 transition-[width] duration-150"
                :style="{ width: `${speedPercent}%` }"
              />
            </div>
          </div>

          <div class="flex items-center gap-8 border-x border-white/15 px-10 text-center">
            <div>
              <p class="hud-kicker">VOLTA</p>
              <p class="mt-1 font-mono text-3xl tabular-nums">{{ inspection.laps }}</p>
            </div>
            <div>
              <p class="hud-kicker">CHECKPOINT</p>
              <p class="mt-1 font-mono text-3xl tabular-nums">{{ inspection.cp + 1 }}</p>
            </div>
            <div>
              <p class="hud-kicker">RECOMPENSA</p>
              <p class="mt-1 font-mono text-3xl tabular-nums">{{ inspection.reward.toFixed(1) }}</p>
            </div>
          </div>

          <div class="ml-auto w-full max-w-sm">
            <div class="mb-2 flex items-end justify-between">
              <div>
                <p class="hud-kicker">DECISÃO DA REDE</p>
                <p class="mt-1 text-sm font-medium tracking-wider">{{ steeringLabel }}</p>
              </div>
              <p class="font-mono text-xs text-white/55">
                ACEL {{ inspection.appliedForward >= 0 ? '+' : ''
                }}{{ inspection.appliedForward.toFixed(2) }}
              </p>
            </div>
            <div class="relative h-1 bg-white/15">
              <span class="absolute left-1/2 -top-0.75 h-1.75 w-px bg-white/50" />
              <span
                class="absolute -top-0.5 h-1.25 w-2 rounded-full bg-cyan-300 transition-[left] duration-100"
                :style="{ left: `${50 + inspection.appliedSteer * 45}%` }"
              />
            </div>
            <div class="mt-5 flex items-center gap-3">
              <span class="hud-kicker shrink-0">LIMITE DO CHECKPOINT</span>
              <div class="h-px grow bg-white/15">
                <div class="h-px bg-rose-400" :style="{ width: `${checkpointProgress}%` }" />
              </div>
              <span class="font-mono text-[10px] text-white/55">
                {{ inspection.time.toFixed(1) }} / {{ inspection.maxTime.toFixed(1) }}s
              </span>
            </div>
          </div>
        </div>

        <div
          class="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-1.5 shadow-2xl backdrop-blur-md"
        >
          <base-button
            :variant="cameraMode === 'follow' ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            title="Seguir kart"
            @click="cameraMode = 'follow'"
          >
            <focus />
          </base-button>
          <base-button
            :variant="cameraMode === 'full' ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            title="Ver pista completa"
            @click="cameraMode = 'full'"
          >
            <camera />
          </base-button>
          <div class="my-1 h-px w-4 bg-border/50" />
          <base-button
            variant="outline"
            size="icon"
            class="rounded-lg"
            title="Próximo kart"
            @click="nextKart"
          >
            <scan-line />
          </base-button>
          <base-button
            :variant="cinematicDirector.enabled ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            title="Alternar diretor cinematic"
            @click="cinematicDirector.toggle"
          >
            <scan-line />
          </base-button>
          <base-button
            :variant="debugMode ? 'primary' : 'outline'"
            size="icon"
            class="rounded-lg"
            :title="debugMode ? 'Ocultar diagnóstico' : 'Mostrar diagnóstico'"
            @click="toggleDiagnostics"
          >
            <brain />
          </base-button>
          <div class="my-1 h-px w-4 bg-border/50" />
          <base-button
            variant="outline"
            size="icon"
            class="rounded-lg"
            :title="isFullscreen ? 'Sair da tela cheia' : 'Modo apresentação (F)'"
            @click="toggleFullscreen"
          >
            <minimize-2 v-if="isFullscreen" />
            <maximize-2 v-else />
          </base-button>
        </div>

        <div
          v-if="!isFullscreen"
          class="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 border border-white/10 bg-black/45 px-2.5 py-1.5 text-[10px] text-white/70 backdrop-blur-md"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          PPO {{ ppoTraining ? 'treinando' : 'em teste' }} · {{ timeMultiplier }}x ·
          {{ cameraMode === 'full' ? 'pista completa' : 'seguindo kart' }}
        </div>
      </div>
    </div>

    <kart-panel
      :metrics="trainingMetrics"
      :source="inspection.source"
      :kart-speed="inspection.speed"
      :checkpoint="inspection.cp"
      :laps="inspection.laps"
      :timeout="inspection.time"
      :max-timeout="inspection.maxTime"
      :last-reward="inspection.lastReward"
      :best-laps="inspection.bestLaps"
      :checkpoint-limit="checkpointLimit"
      :track-type="trackType"
      :checkpoint-status="checkpointStatus"
      :debug-mode="debugMode"
      :cinematic-director="cinematicDirector.enabled.value"
      :include-player="includePlayer"
      :policy-inputs="inspection.policyInputs"
      :policy-outputs="inspection.policyOutputs"
      :applied-forward="inspection.appliedForward"
      :applied-steer="inspection.appliedSteer"
      :front-sensors="inspection.frontSensors"
      :rear-sensors="inspection.rearSensors"
      @update:speed="timeMultiplier = Math.max(1, Math.round($event))"
      @update:checkpoint-limit="setCheckpointLimit"
      @update:track-type="changeTrack"
      @update:cinematic-director="(value) => { cinematicDirector.enabled.value = value; cinematicDirector.start() }"
      @update:include-player="setIncludePlayer"
      @save="saveCheckpoint"
      @load="chooseCheckpoint"
      @clear="clearCheckpoint"
      @toggle-training="togglePPOTraining"
    />

    <input
      ref="checkpointInput"
      type="file"
      accept=".nnw,application/octet-stream"
      hidden
      @change="loadCheckpoint"
    />
  </main>
</template>

<style scoped>
.cinematic-stage:fullscreen {
  width: 100vw;
  height: 100vh;
  background: #080b0d;
}

.cinematic-vignette {
  background:
    linear-gradient(
      180deg,
      rgb(0 0 0 / 0.68) 0%,
      transparent 28%,
      transparent 68%,
      rgb(0 0 0 / 0.76) 100%
    ),
    radial-gradient(circle at center, transparent 48%, rgb(0 0 0 / 0.48) 100%);
}

.hud-kicker {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.24em;
  color: rgb(255 255 255 / 0.45);
}

.is-cinematic :deep(canvas) {
  filter: saturate(0.92) contrast(1.08);
}

@media (max-width: 900px) {
  .cinematic-hud-bottom {
    gap: 1rem;
    padding: 1.25rem;
  }
}
</style>
