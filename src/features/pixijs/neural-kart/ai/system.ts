import { world } from '@/shared/ecs/world'
import { Transform, Input, AISensors, Velocity, KartConfig, AI } from '../kart/traits'
import type { Track } from '../track/track-types'
import { Progress } from '../track/track-checkpoints'
import { cross, dot, findNearestPoint, normalize } from '@/shared/pixijs/common-math'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export const aiSystem = (track: Track) => {
  return () => {
    world
      .query(Input, AISensors, Velocity, KartConfig, AI, Transform, Progress)
      .updateEach(([input, sensors, velocity, config, ai, transform, progress]) => {
        if (!ai.env) return

        // 1. Reward shaping based on actual progress toward the next checkpoint.
        const nextCpIndex = (progress.currentCheckpoint + 1) % track.checkpoints.length
        const nextCp = track.checkpoints[nextCpIndex]
        let frameReward = 0

        if (nextCp) {
          const toCpX = nextCp.x - transform.x
          const toCpY = nextCp.y - transform.y
          const distToCp = Math.sqrt(toCpX * toCpX + toCpY * toCpY)
          const previousDistance = Number.isFinite(progress.distanceToNext) ? progress.distanceToNext : distToCp
          const progressDelta = previousDistance - distToCp

          // Only reward actual forward progress, not proximity alone.
          if (progressDelta > 0) {
            frameReward += clamp(progressDelta / 90, 0, 0.7)
          } else if (progressDelta < 0) {
            frameReward -= clamp(Math.abs(progressDelta) / 140, 0, 0.25)
          }

          // Small shaping bonus for moving at all, so the agent does not learn to freeze.
          const speedFactor = velocity.speed / config.maxSpeed
          frameReward += Math.max(0, speedFactor) * 0.01

          // Stronger penalty for almost not moving.
          if (speedFactor < 0.03) frameReward -= 0.05

          const centerPoint = findNearestPoint({ x: transform.x, y: transform.y }, track.centerLine)
          const centerIndex = track.centerLine.findIndex((p) => p.x === centerPoint.x && p.y === centerPoint.y)
          if (centerIndex >= 0) {
            const prevIndex = Math.max(0, centerIndex - 1)
            const nextIndex = Math.min(track.centerLine.length - 1, centerIndex + 1)
            const prev = track.centerLine[prevIndex]
            const next = track.centerLine[nextIndex]

            if (!prev || !next) return

            const tangent = normalize({ x: next.x - prev.x, y: next.y - prev.y })
            const toKart = { x: transform.x - centerPoint.x, y: transform.y - centerPoint.y }
            const lateral = clamp(cross(tangent, toKart) / (track.width * 0.5), -1, 1)
            const heading = { x: Math.cos(transform.rotation), y: Math.sin(transform.rotation) }
            const trackForward = normalize({ x: next.x - prev.x, y: next.y - prev.y })
            const alignment = clamp(dot(heading, trackForward), -1, 1)

            // Reward center/alignment only when the kart is actually moving.
            if (velocity.speed > 0.1) {
              frameReward += Math.max(0, 1 - Math.abs(lateral)) * 0.04
              frameReward += Math.max(0, alignment) * 0.03
            }

            // Slight penalty for being off-center.
            frameReward -= Math.abs(lateral) * 0.03
          }

          // Penalize reverse motion.
          if (velocity.speed < -0.1) frameReward -= Math.min(0.25, Math.abs(velocity.speed / config.maxSpeed) * 0.2)

          if (progress.stationaryTime > 20) {
            frameReward -= Math.min(0.4, (progress.stationaryTime - 20) / 80)
          }
        }

        frameReward += ai.env.reward

        // 2. Perform Action and Update Policy
        const features = [
          ...sensors.distances.map((d) => d / sensors.maxDistance),
          ...sensors.rearDistances.map((d) => d / sensors.maxDistance),
          velocity.speed / config.maxSpeed,
        ]

        const action = ai.env.step(features, frameReward, ai.env.done)
        ai.env.reward = 0

        // 3. Handle Reset AFTER processing the terminal reward
        if (ai.env.done) {
          const spawn = track.spawnPoints[0]
          if (spawn) {
            transform.x = spawn.x
            transform.y = spawn.y
            transform.rotation = spawn.rotation
            velocity.speed = 0
            velocity.x = 0
            velocity.y = 0
          }
          ai.env.reset()
          progress.timeSinceLastCheckpoint = 0
          progress.currentCheckpoint = 0
          progress.distanceToNext = Number.POSITIVE_INFINITY
          return
        }

        // 4. Update Inputs from PPO Action
        if (input.source === 'ai' && action) {
          input.forward = Math.max(-1, Math.min(1, action[0] ?? 0))
          input.steer = Math.max(-1, Math.min(1, action[1] ?? 0))
        }
      })
  }
}
