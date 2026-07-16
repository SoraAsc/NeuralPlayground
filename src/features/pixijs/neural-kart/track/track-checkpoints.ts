import { trait } from 'koota'
import { world } from '@/shared/ecs/world'
import { Transform, AI } from '../kart/traits'
import type { Track } from './track-types'
import { distanceSq } from '@/shared/pixijs/common-math'

export const Progress = trait({
  currentCheckpoint: 0,
  laps: 0,
  timeSinceLastCheckpoint: 0,
  timeSinceSpawn: 0,
  distanceToNext: Number.POSITIVE_INFINITY,
  lastDistanceToNext: Number.POSITIVE_INFINITY,
  lastX: 0,
  lastY: 0,
  stationaryTime: 0,
  maxTimePerCheckpoint: 20,
})

export const checkpointSystem = (track: Track) => {
  return (delta: number) => {
    world.query(Transform, Progress).updateEach(([transform, progress], entity) => {
      progress.timeSinceLastCheckpoint += delta
      progress.timeSinceSpawn += delta

      const movedDistance = Math.sqrt(
        (transform.x - progress.lastX) * (transform.x - progress.lastX) +
          (transform.y - progress.lastY) * (transform.y - progress.lastY),
      )
      if (movedDistance < 5 * delta) {
        progress.stationaryTime += delta
      } else {
        progress.stationaryTime = 0
      }
      progress.lastX = transform.x
      progress.lastY = transform.y

      const nextCpIndex = (progress.currentCheckpoint + 1) % track.checkpoints.length
      const cp = track.checkpoints[nextCpIndex]
      if (!cp) return

      progress.lastDistanceToNext = progress.distanceToNext
      const distSq = distanceSq({ x: transform.x, y: transform.y }, { x: cp.x, y: cp.y })
      progress.distanceToNext = Math.sqrt(distSq)
      const threshold = Math.max(12, cp.width * 0.5)
      const thresholdSq = threshold * threshold

      if (distSq < thresholdSq) {
        progress.currentCheckpoint = nextCpIndex
        progress.timeSinceLastCheckpoint = 0
        progress.distanceToNext = 0
        if (nextCpIndex === 0) progress.laps++

        // Reward AI
        const ai = entity.get(AI)
        if (ai && ai.env) {
          ai.env.reward += 30
          if (nextCpIndex === 0) {
            ai.env.reward += 60
          }
        }
      }

      if (progress.stationaryTime > 4) {
        const ai = entity.get(AI)
        if (ai && ai.env) {
          ai.env.reward -= 8
          ai.env.done = true
        }
        progress.stationaryTime = 0
      } else if (progress.timeSinceLastCheckpoint > progress.maxTimePerCheckpoint) {
        const ai = entity.get(AI)
        if (ai && ai.env) {
          ai.env.reward -= 12
          ai.env.done = true
        }
        progress.timeSinceLastCheckpoint = 0
      }
    })
  }
}
