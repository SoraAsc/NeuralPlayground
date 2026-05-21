import type { ConfigurableTrait } from 'koota'
import { Time } from './timer'
import { InSimulation, world } from './world'

export function createSimulation() {
  const simulationRoot = world.spawn(Time({ delta: 0, elapsed: 0 }))

  return {
    root: simulationRoot,

    spawnEntity: (...traits: ConfigurableTrait[]) => {
      return world.spawn(...traits, InSimulation(simulationRoot))
    },

    destroy: () => simulationRoot.destroy(),
  }
}
