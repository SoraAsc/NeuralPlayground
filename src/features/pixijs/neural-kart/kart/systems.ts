import { Graphics } from 'pixi.js'
import { pixiApp } from '@/shared/pixijs/pixi-app'
import { world } from '@/shared/ecs/world'
import { Transform, Velocity, Input, KartConfig, Sprite, AISensors, AI, Destroyed } from './traits'

const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
}

let sensorGraphics: Graphics | null = null

function getSensorGraphics(): Graphics {
  if (!sensorGraphics) {
    sensorGraphics = new Graphics()
  }
  if (!sensorGraphics.parent) {
    pixiApp.stage.addChild(sensorGraphics)
  }
  return sensorGraphics
}

export function releaseKartRendering() {
  sensorGraphics?.destroy()
  sensorGraphics = null
}

export function setKartInputKey(key: string, pressed: boolean) {
  const normalizedKey = key.toLowerCase()
  if (normalizedKey in keys) keys[normalizedKey as keyof typeof keys] = pressed
}

export function resetKartInputKeys() {
  for (const key of Object.keys(keys) as Array<keyof typeof keys>) keys[key] = false
}

export function cleanupSystem() {
  world.query(Destroyed).updateEach((_, entity) => {
    // Cleanup Sprite
    const sprite = entity.get(Sprite)
    if (sprite) sprite.view?.destroy({ children: true })

    // Cleanup AI (Free WASM memory)
    const ai = entity.get(AI)
    if (ai) ai.env?.dispose()

    // Finally destroy the entity
    entity.destroy()
  })
}

export function inputSystem() {
  world.query(Input).updateEach(([input]) => {
    if (input.source === 'manual') {
      input.forward = (keys.w ? 1 : 0) - (keys.s ? 1 : 0)
      input.steer = (keys.d ? 1 : 0) - (keys.a ? 1 : 0)
    }
  })
}

export function movementSystem(delta: number) {
  world
    .query(Transform, Velocity, Input, KartConfig)
    .updateEach(([transform, velocity, input, config]) => {
      // Steering
      if (Math.abs(velocity.speed) > 10) {
        const steeringDirection = velocity.speed > 0 ? 1 : -1
        transform.rotation += input.steer * config.steeringSpeed * delta * steeringDirection
      }

      // Acceleration / Friction
      if (input.forward > 0) {
        velocity.speed += input.forward * config.acceleration * delta
      } else if (input.forward < 0) {
        velocity.speed -= Math.abs(input.forward) * config.deceleration * delta
      } else {
        // Friction
        if (Math.abs(velocity.speed) > config.friction * delta) {
          velocity.speed -= Math.sign(velocity.speed) * config.friction * delta
        } else velocity.speed = 0
      }

      // Clamp speed
      velocity.speed = Math.max(0, Math.min(config.maxSpeed, velocity.speed))

      // Update position
      velocity.x = Math.cos(transform.rotation) * velocity.speed
      velocity.y = Math.sin(transform.rotation) * velocity.speed

      transform.x += velocity.x * delta
      transform.y += velocity.y * delta
    })
}

export function renderSystem() {
  const sg = getSensorGraphics()
  sg.clear()

  world.query(Transform, Sprite, AISensors).updateEach(([transform, sprite, sensors]) => {
    if (!sprite || !sprite.view) return
    const view = sprite.view
    view.x = transform.x
    view.y = transform.y
    view.rotation = transform.rotation + Math.PI / 2

    // Render sensor rays if active
    if (sensors.showVisuals) {
      // Front
      const startAngle = -Math.PI / 2 // 90 degrees left
      const endAngle = Math.PI / 2 // 90 degrees right
      const step = sensors.numRays > 1 ? (endAngle - startAngle) / (sensors.numRays - 1) : 0

      for (let i = 0; i < sensors.numRays; i++) {
        const angle = transform.rotation + startAngle + i * step
        const dist = sensors.distances[i] || sensors.maxDistance

        sg.moveTo(transform.x, transform.y)
        sg.lineTo(transform.x + Math.cos(angle) * dist, transform.y + Math.sin(angle) * dist)
      }

      sg.stroke({ width: 1, color: 0xffffff, alpha: 0.55 })

      // Rear
      const rearHalfArc = Math.PI / 4
      const rearStep = sensors.numRearRays > 1 ? (rearHalfArc * 2) / (sensors.numRearRays - 1) : 0

      for (let i = 0; i < sensors.numRearRays; i++) {
        const angle = transform.rotation + Math.PI - rearHalfArc + i * rearStep
        const dist = sensors.rearDistances[i] ?? sensors.maxDistance

        sg.moveTo(transform.x, transform.y)
        sg.lineTo(transform.x + Math.cos(angle) * dist, transform.y + Math.sin(angle) * dist)
      }

      sg.stroke({ width: 1, color: 0xffffff, alpha: 0.28 })
    }
  })
}
