import { world } from '@/shared/ecs/world'
import { Transform, Velocity } from '../kart/traits'
import type { Track } from './track-types'
import { isRoad } from './track-mask'
import { findNearestPoint, normalize } from '@/shared/pixijs/common-math'

export const trackCollisionSystem = (track: Track) => {
  return () => {
    world.query(Transform, Velocity).updateEach(([transform, velocity]) => {
      if (!isRoad(track, transform.x, transform.y)) {
        // Crash simulation: find nearest point on track and push back
        const nearest = findNearestPoint({ x: transform.x, y: transform.y }, track.centerLine)

        // Push vector
        const dx = nearest.x - transform.x
        const dy = nearest.y - transform.y
        const push = normalize({ x: dx, y: dy })

        // Push back into track
        transform.x += push.x * 10
        transform.y += push.y * 10

        // Bounce/Stop effect
        velocity.speed = -velocity.speed * 0.3
        if (Math.abs(velocity.speed) < 20) velocity.speed = 0
      }
    })
  }
}
