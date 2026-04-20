import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import type { EpisodePayloadI } from '.'
import type GameTemplate from '../../ui/GameTemplate.vue'

export function useNeuralSnake(game: Ref<InstanceType<typeof GameTemplate> | null>) {
  const episodes = ref(0)
  const simulations = ref<number[]>([])
  const currentSimulationIndex = ref<number | null>(null)

  // const startTraining = () => {
  //   if (currentSimulationIndex.value !== null)
  //     game.value?.sendMessage('WebInterfaceObject', 'StartTraining', currentSimulationIndex.value)
  // }

  const createSimulation = () => {
    if (currentSimulationIndex.value !== null)
      game.value?.sendMessage('WebInterfaceObject', 'CreateSimulation')
  }

  const removeSimulation = (index: number) => {
    if (currentSimulationIndex.value !== null)
      game.value?.sendMessage('WebInterfaceObject', 'RemoveSimulation', index)
  }

  const changeSelectedSimulation = (index: number) => {
    if (index < -1 && simulations.value.length > 0 && simulations.value.length > index) return
    currentSimulationIndex.value = index
  }

  const handleSimulationCreated = (event: CustomEvent<{ index: number }>) => {
    const index = event.detail.index

    if (!simulations.value.includes(index)) simulations.value.push(index)

    if (currentSimulationIndex.value === null) currentSimulationIndex.value = index
  }

  const handleSimulationRemoved = (event: CustomEvent<{ index: number }>) => {
    const index = event.detail.index

    simulations.value = simulations.value.filter((s) => s !== index)

    if (currentSimulationIndex.value === index) {
      const next = simulations.value[0]
      currentSimulationIndex.value = next ?? null
    }
  }

  const handleEpisodeUpdate = (event: CustomEvent<EpisodePayloadI>) => {
    episodes.value = event.detail.episodes
  }

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
    window.addEventListener(
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
  }
  // return { episodes, currentSimulationIndex, game, startTraining }
}
