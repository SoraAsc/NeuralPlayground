import { trait } from 'koota'
import type { Container } from 'pixi.js'
import type { NeuralKartEnvironment } from '../ai/neural-env'

export const Transform = trait({
  x: 0,
  y: 0,
  rotation: 0,
})

export const Velocity = trait({
  x: 0,
  y: 0,
  speed: 0,
})

export const Input = trait({
  forward: 0, // -1 to 1
  steer: 0, // -1 to 1
  source: 'manual' as 'manual' | 'ai',
})

export const AI = trait(() => ({
  env: null as NeuralKartEnvironment | null,
}))

export const AISensors = trait(() => ({
  distances: [] as number[],
  rearDistances: [] as number[],
  numRays: 5,
  numRearRays: 3,
  maxDistance: 200,
  showVisuals: false,
}))

export const KartConfig = trait({
  maxSpeed: 400,
  acceleration: 600,
  deceleration: 300,
  friction: 100,
  steeringSpeed: 4,
  width: 20,
  length: 30,
})

export const Sprite = trait(() => ({
  view: null as Container | null,
}))

export const Destroyed = trait({})
