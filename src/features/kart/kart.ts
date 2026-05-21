import { Sprite as PixiSprite, Assets } from 'pixi.js'
import { pixiApp } from '@/shared/pixijs/pixi-app'
import { world } from '@/shared/ecs/world'
import { Transform, Velocity, Input, KartConfig, Sprite } from './traits'

export async function spawnKart(x: number, y: number) {
  // Load texture explicitly to avoid cache warnings
  const texture = await Assets.load('/sprites/kart/compact_blue.png')
  const kartView = new PixiSprite(texture)

  // centraliza origem do sprite
  kartView.anchor.set(0.5)

  // Define um tamanho base mantendo a proporção
  const targetWidth = 20
  const scale = targetWidth / texture.width
  kartView.scale.set(scale)

  pixiApp.stage.addChild(kartView)

  return world.spawn(
    Transform({ x, y, rotation: 0 }),
    Velocity({ x: 0, y: 0, speed: 0 }),
    Input({ forward: 0, steer: 0 }),
    KartConfig(),
    Sprite({ view: kartView }),
  )
}
