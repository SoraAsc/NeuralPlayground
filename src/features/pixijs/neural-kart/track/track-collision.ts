import { world } from '@/shared/ecs/world'
import { Transform, Velocity, KartConfig, AI } from '../kart/traits'
import type { Track } from './track-types'
import { isRoad } from './track-mask'
import { Progress } from './track-checkpoints'

export const trackCollisionSystem = (track: Track) => {
  return () => {
    world
      .query(Transform, Velocity, KartConfig, Progress)
      .updateEach(([transform, velocity, config, progress], entity) => {
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
          const spawn = track.spawnPoints[0]
          if (spawn) {
            transform.x = spawn.x
            transform.y = spawn.y
            transform.rotation = spawn.rotation
          }

          velocity.speed = 0
          velocity.x = 0
          velocity.y = 0
          progress.timeSinceLastCheckpoint = 0
          progress.currentCheckpoint = 0
          progress.distanceToNext = Infinity

          // Penalty for AI
          const ai = entity.get(AI)
          if (ai && ai.env) {
            ai.env.reward -= 10
            ai.env.done = true
          }
        }
      })
  }
}
