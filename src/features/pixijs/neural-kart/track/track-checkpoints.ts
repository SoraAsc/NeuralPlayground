import { trait } from 'koota'
import { world } from '@/shared/ecs/world'
import { Transform } from '../kart/traits'
import type { Track } from './track-types'
import { distanceSq } from '@/shared/pixijs/common-math'

export const Progress = trait({
  currentCheckpoint: 0,
  laps: 0,
  distanceToNext: 0,
})

export const checkpointSystem = (track: Track) => {
  return () => {
    world.query(Transform, Progress).updateEach(([transform, progress]) => {
      const nextCpIndex = (progress.currentCheckpoint + 1) % track.checkpoints.length
      const cp = track.checkpoints[nextCpIndex]
      if (!cp) return

      const distSq = distanceSq({ x: transform.x, y: transform.y }, { x: cp.x, y: cp.y })
      const thresholdSq = track.width * track.width // Use track width as threshold

      if (distSq < thresholdSq) {
        progress.currentCheckpoint = nextCpIndex
        if (nextCpIndex === 0) progress.laps++
      }
    })
  }
}
