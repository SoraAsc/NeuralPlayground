import { trait } from 'koota'
import { world } from '../ecs/world'
import { pixiApp } from '../pixijs/pixi-app'

export const Time = trait({
  delta: 0,
  elapsed: 0,
})

export function startGameLoop(updateSystems: (delta: number) => void) {
  pixiApp.ticker.add((ticker) => {
    const deltaInSeconds = ticker.deltaTime / 60
    world.query(Time).updateEach(([time]) => {
      time.delta = deltaInSeconds
      time.elapsed += deltaInSeconds
    })

    updateSystems(deltaInSeconds)
  })
}
