import { ref, onMounted, onUnmounted, type Ref, watch, nextTick } from 'vue'
import type { EpisodePayloadI } from '.'
import type GameTemplate from '../../ui/GameTemplate.vue'
import { useTheme } from '@/shared/lib/theme/useTheme'
import { getVariableHex } from '@/shared/lib/utils'

export function useNeuralSnake(game: Ref<InstanceType<typeof GameTemplate> | null>) {
  const { theme } = useTheme()
  const episodes = ref(0)
  const simulations = ref<number[]>([])
  const currentSimulationIndex = ref<number | null>(null)

  // const startTraining = () => {
  //   if (currentSimulationIndex.value !== null)
  //     game.value?.sendMessage('WebInterfaceObject', 'StartTraining', currentSimulationIndex.value)
  // }

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
  }

  const handleSimulationCreated = (event: CustomEvent<{ index: number }>) => {
    const index = event.detail.index

    if (!simulations.value.includes(index)) simulations.value.push(index)

    if (currentSimulationIndex.value === null) currentSimulationIndex.value = index
  }

  const handleSimulationRemoved = (event: CustomEvent<{ index: number }>) => {
    const removedIndex = event.detail.index

    simulations.value = simulations.value
      .filter((s) => s !== removedIndex)
      .map((s) => (s > removedIndex ? s - 1 : s))

    if (currentSimulationIndex.value === removedIndex) {
      const next = simulations.value[0]
      currentSimulationIndex.value = next ?? null
      changeSimulationFocus(currentSimulationIndex.value ?? -1)
    } else if (currentSimulationIndex.value && currentSimulationIndex.value > removedIndex) {
      currentSimulationIndex.value -= 1
    }
  }

  const handleEpisodeUpdate = (event: CustomEvent<EpisodePayloadI>) => {
    episodes.value = event.detail.episodes
  }

  const changeSimulationFocus = (index: number) => {
    game.value?.sendMessage('WebInterfaceObject', 'FocusSimulation', index)
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
  })

  return {
    simulations,
    currentSimulationIndex,
    changeSelectedSimulation,
    createSimulation,
    removeSimulation,
    syncBackgroundColor,
  }
  // return { episodes, currentSimulationIndex, game, startTraining }
}
