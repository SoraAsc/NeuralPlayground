import { ref, onMounted, onUnmounted, type Ref, watch, nextTick } from 'vue'
import type { EpisodePayloadI, StatsPayloadI } from '.'
import type GameTemplate from '../../ui/GameTemplate.vue'
import { useTheme } from '@/shared/lib/theme/useTheme'
import { getVariableHex } from '@/shared/lib/utils'

export interface SimulationI extends Partial<StatsPayloadI> {
  index: number
  rewardHistory: number[]
  episodes: number
}

const MAX_REWARDS_HISTORY = 1000

export function useNeuralSnake(game: Ref<InstanceType<typeof GameTemplate> | null>) {
  const { theme } = useTheme()
  const episodes = ref(0)
  const simulations = ref<SimulationI[]>([])
  const currentSimulationIndex = ref<number | null>(null)

  const createSimulation = () => {
    game.value?.sendMessage('WebInterfaceObject', 'CreateSimulation')
    if (currentSimulationIndex.value === -1) changeSimulationFocus(-1)
  }

  const removeSimulation = (index: number) => {
    game.value?.sendMessage('WebInterfaceObject', 'RemoveSimulation', index)
    if (currentSimulationIndex.value === -1) changeSimulationFocus(-1)
  }

  const syncBackgroundColor = async () => {
    await nextTick()
    const hex = getVariableHex('--card')
    game.value?.sendMessage('WebInterfaceObject', 'SetBackgroundColorHex', hex)
  }

  const changeSelectedSimulation = (index: number) => {
    if (index < -1 && simulations.value.length > 0 && simulations.value.length > index) return
    currentSimulationIndex.value = index
    changeSimulationFocus(index)

    if (index !== -1) {
      const sim = simulations.value.find((s) => s.index === index)
      if (sim) episodes.value = sim.episodes
    }
  }

  const handleSimulationCreated = (event: CustomEvent<{ index: number }>) => {
    const index = event.detail.index

    if (!simulations.value.find((s) => s.index === index))
      simulations.value.push({ index, rewardHistory: [], episodes: 0 })
    if (currentSimulationIndex.value === null) currentSimulationIndex.value = index
  }

  const handleSimulationRemoved = (event: CustomEvent<{ index: number }>) => {
    const removedIndex = event.detail.index

    simulations.value = simulations.value
      .filter((s) => s.index !== removedIndex)
      .map((s) => ({
        ...s,
        index: s.index > removedIndex ? s.index - 1 : s.index,
      }))

    if (currentSimulationIndex.value === removedIndex) {
      const next = simulations.value[0]
      currentSimulationIndex.value = next?.index ?? null
      changeSimulationFocus(currentSimulationIndex.value ?? -1)
    } else if (currentSimulationIndex.value && currentSimulationIndex.value > removedIndex) {
      currentSimulationIndex.value -= 1
    }
  }

  const handleEpisodeUpdate = (event: CustomEvent<EpisodePayloadI>) => {
    const { index, episodes: episodeCount } = event.detail
    const sim = simulations.value.find((s) => s.index === index)

    if (sim) {
      if (sim.reward !== undefined) {
        sim.rewardHistory.push(sim.reward)
        if (sim.rewardHistory.length > MAX_REWARDS_HISTORY) {
          sim.rewardHistory.shift()
        }
      }
      sim.episodes = episodeCount
    }

    if (index === currentSimulationIndex.value) {
      episodes.value = episodeCount
    }
  }

  const handleStatsUpdated = (event: CustomEvent<StatsPayloadI>) => {
    const data = event.detail
    const sim = simulations.value.find((s) => s.index === data.index)
    if (sim) {
      Object.assign(sim, data)
    }
  }

  const changeSimulationFocus = (index: number) => {
    game.value?.sendMessage('WebInterfaceObject', 'FocusSimulation', index)
  }

  const startTraining = () => {
    if (currentSimulationIndex.value === null) return
    game.value?.sendMessage('WebInterfaceObject', 'StartTraining', currentSimulationIndex.value)
  }

  const startTesting = () => {
    if (currentSimulationIndex.value === null) return
    game.value?.sendMessage('WebInterfaceObject', 'StartTesting', currentSimulationIndex.value)
  }

  const pauseSimulation = () => {
    if (currentSimulationIndex.value === null) return
    game.value?.sendMessage('WebInterfaceObject', 'PauseSimulation', currentSimulationIndex.value)
  }

  watch(theme, syncBackgroundColor)

  onMounted(() => {
    window.addEventListener(
      'neuralSnake:simulationCreated',
      handleSimulationCreated as EventListener,
    )
    window.addEventListener(
      'neuralSnake:simulationRemoved',
      handleSimulationRemoved as EventListener,
    )
    window.addEventListener('neuralSnake:episodesUpdated', handleEpisodeUpdate as EventListener)
    window.addEventListener('neuralSnake:statsUpdated', handleStatsUpdated as EventListener)
  })
  onUnmounted(() => {
    window.removeEventListener(
      'neuralSnake:simulationCreated',
      handleSimulationCreated as EventListener,
    )
    window.removeEventListener(
      'neuralSnake:simulationRemoved',
      handleSimulationRemoved as EventListener,
    )
    window.removeEventListener('neuralSnake:episodesUpdated', handleEpisodeUpdate as EventListener)
    window.removeEventListener('neuralSnake:statsUpdated', handleStatsUpdated as EventListener)
  })

  return {
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
  }
}
