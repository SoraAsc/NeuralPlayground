import { Assets, Sprite as PixiSprite } from 'pixi.js'
import { pixiApp } from '@/shared/pixijs/pixi-app'
import { world } from '@/shared/ecs/world'
import { Transform, Velocity, Input, KartConfig, Sprite, AISensors, AI } from './traits'
import { Progress } from '../track/track-checkpoints'
import { NeuralKartEnvironment } from '../ai/neural-env'

export type KartType = 'compact' | 'sport'

interface KartDefinition {
  sprite: string
  tint?: number
  config: {
    maxSpeed: number
    acceleration: number
    deceleration: number
    friction: number
    steeringSpeed: number
  }
}

export const KART_DEFINITIONS: Record<KartType, KartDefinition> = {
  compact: {
    sprite: '/sprites/kart/compact_blue.png',
    config: {
      maxSpeed: 400,
      acceleration: 600,
      deceleration: 300,
      friction: 100,
      steeringSpeed: 4,
    },
  },
  sport: {
    sprite: '/sprites/kart/sport_yellow.png',
    config: {
      maxSpeed: 600,
      acceleration: 800,
      deceleration: 400,
      friction: 80,
      steeringSpeed: 3.5,
    },
  },
}

export async function createKart(
  type: KartType,
  x: number,
  y: number,
  rotation: number = 0,
  source: 'manual' | 'ai' = 'manual',
) {
  const definition = KART_DEFINITIONS[type]

  // Load texture
  const texture = await Assets.load(definition.sprite)
  const kartView = new PixiSprite(texture)

  // Centralize origin
  kartView.anchor.set(0.5)

  // Base scale
  const targetWidth = 20
  const scale = targetWidth / texture.width
  const targetLength = texture.height * scale
  kartView.scale.set(scale)

  // Apply tint if available
  if (definition.tint) kartView.tint = definition.tint

  pixiApp.stage.addChild(kartView)

  const entity = world.spawn(
    Transform({ x, y, rotation }),
    Velocity({ x: 0, y: 0, speed: 0 }),
    Input({ forward: 0, steer: 0, source }),
    KartConfig({
      ...definition.config,
      width: targetWidth,
      length: targetLength,
    }),
    Sprite({ view: kartView }),
    AISensors({
      distances: [],
      numRays: 5,
      numRearRays: 3,
      rearDistances: [],
      maxDistance: 200,
      showVisuals: true,
    }),
    Progress({ currentCheckpoint: 0, laps: 0 }),
  )

  if (source === 'ai' || source === 'manual') {
    // Inputs:
    // velocity (2) + alignment/lateral (2) + checkpoint direction sin/cos (2)
    // + checkpoint distance (1) + front sensors (5) + rear sensors (3) = 15
    // Outputs: forward + steer = 2
    const env = await NeuralKartEnvironment.create(15, 2)
    entity.add(AI({ env }))
  }

  return entity
}
