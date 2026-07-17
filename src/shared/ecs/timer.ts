import { trait } from 'koota'
import { world } from '../ecs/world'
import { pixiApp } from '../pixijs/pixi-app'
import type { Ticker } from 'pixi.js'

export const Time = trait({
  delta: 0,
  elapsed: 0,
})

export function startGameLoop(updateSystems: (delta: number) => void) {
  const tick = (ticker: Ticker) => {
    const deltaInSeconds = ticker.deltaTime / 60
    world.query(Time).updateEach(([time]) => {
      time.delta = deltaInSeconds
      time.elapsed += deltaInSeconds
    })

    updateSystems(deltaInSeconds)
  }
  pixiApp.ticker.add(tick)
  return () => pixiApp.ticker.remove(tick)
}
