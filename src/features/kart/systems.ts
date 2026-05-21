import { world } from '@/shared/ecs/world'
import { Transform, Velocity, Input, KartConfig, Sprite } from './traits'

const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
}

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase() as keyof typeof keys] = true
})

window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase() as keyof typeof keys] = false
})

export function inputSystem() {
  world.query(Input).updateEach(([input]) => {
    input.forward = (keys.w ? 1 : 0) - (keys.s ? 1 : 0)
    input.steer = (keys.d ? 1 : 0) - (keys.a ? 1 : 0)
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
      if (input.forward !== 0) {
        velocity.speed += input.forward * config.acceleration * delta
      } else {
        // Friction
        if (Math.abs(velocity.speed) > config.friction * delta) {
          velocity.speed -= Math.sign(velocity.speed) * config.friction * delta
        } else {
          velocity.speed = 0
        }
      }

      // Clamp speed
      velocity.speed = Math.max(-config.maxSpeed / 2, Math.min(config.maxSpeed, velocity.speed))

      // Update position
      velocity.x = Math.cos(transform.rotation) * velocity.speed
      velocity.y = Math.sin(transform.rotation) * velocity.speed

      transform.x += velocity.x * delta
      transform.y += velocity.y * delta
    })
}

export function renderSystem() {
  world.query(Transform, Sprite).updateEach(([transform, sprite]) => {
    if (!sprite || !sprite.view) return
    const view = sprite.view
    view.x = transform.x
    view.y = transform.y
    view.rotation = transform.rotation + Math.PI / 2
  })
}
