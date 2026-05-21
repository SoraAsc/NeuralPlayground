import { Application } from 'pixi.js'

export const pixiApp = new Application()

export async function initPixi(container: HTMLElement) {
  await pixiApp.init({
    resizeTo: container,
    backgroundColor: 0x1099bb,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  container.appendChild(pixiApp.canvas)
}
