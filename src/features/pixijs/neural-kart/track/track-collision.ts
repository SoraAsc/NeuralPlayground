import { world } from '@/shared/ecs/world'
import { Transform, Velocity, KartConfig } from '../kart/traits'
import type { Track } from './track-types'
import { isRoad } from './track-mask'
import { findNearestPoint, normalize } from '@/shared/pixijs/common-math'

export const trackCollisionSystem = (track: Track) => {
  return () => {
    world.query(Transform, Velocity, KartConfig).updateEach(([transform, velocity, config]) => {
      // 1. Define kart points for collision detection
      const halfW = config.width / 2
      const halfL = config.length / 2.5
      const cos = Math.cos(transform.rotation)
      const sin = Math.sin(transform.rotation)

      // 4 Corners + 2 extra points (Front center and back center) for better precision
      const points = [
        // Front Right
        {
          x: transform.x + cos * halfL - sin * halfW,
          y: transform.y + sin * halfL + cos * halfW,
          isFront: true,
        },
        // Front Left
        {
          x: transform.x + cos * halfL + sin * halfW,
          y: transform.y + sin * halfL - cos * halfW,
          isFront: true,
        },
        // Back Right
        {
          x: transform.x - cos * halfL - sin * halfW,
          y: transform.y - sin * halfL + cos * halfW,
          isFront: false,
        },
        // Back Left
        {
          x: transform.x - cos * halfL + sin * halfW,
          y: transform.y - sin * halfL - cos * halfW,
          isFront: false,
        },
        // Front Center
        { x: transform.x + cos * halfL, y: transform.y + sin * halfL, isFront: true },
        // Back Center
        { x: transform.x - cos * halfL, y: transform.y - sin * halfL, isFront: false },
      ]

      let colliding = false

      for (const p of points) {
        if (!isRoad(track, p.x, p.y)) {
          colliding = true
          break
        }
      }

      if (colliding) {
        // Crash simulation: find nearest point on track and push back
        const nearest = findNearestPoint({ x: transform.x, y: transform.y }, track.centerLine)

        // Push vector (from kart towards road center)
        const dx = nearest.x - transform.x
        const dy = nearest.y - transform.y
        const push = normalize({ x: dx, y: dy })

        transform.x += push.x * 0.5
        transform.y += push.y * 0.5
        velocity.speed = 0
      }
    })
  }
}
