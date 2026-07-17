import { Application } from 'pixi.js'

export const pixiApp = new Application()
let initialized = false

export async function initPixi(container: HTMLElement) {
  if (!initialized) {
    await pixiApp.init({
      resizeTo: container,
      backgroundColor: 0x1099bb,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    initialized = true
  } else {
    pixiApp.resizeTo = container
    pixiApp.resize()
    pixiApp.ticker.start()
  }

  container.appendChild(pixiApp.canvas)
}

export function releasePixi() {
  if (!initialized) return
  pixiApp.ticker.stop()
  pixiApp.canvas.remove()
  pixiApp.stage.pivot.set(0, 0)
  pixiApp.stage.position.set(0, 0)
  pixiApp.stage.scale.set(1)
}
