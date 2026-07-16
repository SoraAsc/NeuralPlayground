import { world } from '@/shared/ecs/world'
import { Transform, Input, AISensors, Velocity, KartConfig, AI } from '../kart/traits'
import type { Track } from '../track/track-types'
import { Progress } from '../track/track-checkpoints'
import { cross, dot, findNearestPoint, normalize } from '@/shared/pixijs/common-math'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function angleToPoint(
  transform: { x: number; y: number; rotation: number },
  point: { x: number; y: number },
) {
  const raw = Math.atan2(point.y - transform.y, point.x - transform.x) - transform.rotation
  return Math.atan2(Math.sin(raw), Math.cos(raw))
}

function getTrackFrame(transform: { x: number; y: number; rotation: number }, track: Track) {
  const centerPoint = findNearestPoint({ x: transform.x, y: transform.y }, track.centerLine)
  const centerIndex = track.centerLine.findIndex(
    (p) => p.x === centerPoint.x && p.y === centerPoint.y,
  )
  if (centerIndex < 0) return null

  const prevIndex = Math.max(0, centerIndex - 1)
  const nextIndex = Math.min(track.centerLine.length - 1, centerIndex + 1)
  const prev = track.centerLine[prevIndex]
  const next = track.centerLine[nextIndex]
  if (!prev || !next) return null

  const trackForward = normalize({ x: next.x - prev.x, y: next.y - prev.y })
  const heading = { x: Math.cos(transform.rotation), y: Math.sin(transform.rotation) }
  const alignment = clamp(dot(heading, trackForward), -1, 1)
  const toKart = { x: transform.x - centerPoint.x, y: transform.y - centerPoint.y }
  const lateral = clamp(cross(trackForward, toKart) / Math.max(1, track.width * 0.5), -1, 1)

  return { centerPoint, alignment, lateral }
}

function getTrackSignal(
  transform: { x: number; y: number; rotation: number },
  velocity: { x: number; y: number },
  track: Track,
) {
  const frame = getTrackFrame(transform, track)
  if (!frame) return null

  const velocityMag = Math.hypot(velocity.x, velocity.y)
  const normalizedVelocity =
    velocityMag > 0 ? { x: velocity.x / velocityMag, y: velocity.y / velocityMag } : { x: 0, y: 0 }
  const trackMotion = dot(frameTrackForward(transform, track), normalizedVelocity)
  return {
    ...frame,
    trackMotion,
  }
}

function frameTrackForward(transform: { x: number; y: number; rotation: number }, track: Track) {
  const centerPoint = findNearestPoint({ x: transform.x, y: transform.y }, track.centerLine)
  const centerIndex = track.centerLine.findIndex(
    (p) => p.x === centerPoint.x && p.y === centerPoint.y,
  )
  if (centerIndex < 0) return { x: 1, y: 0 }
  const prevIndex = Math.max(0, centerIndex - 1)
  const nextIndex = Math.min(track.centerLine.length - 1, centerIndex + 1)
  const prev = track.centerLine[prevIndex]
  const next = track.centerLine[nextIndex]
  if (!prev || !next) return { x: 1, y: 0 }
  return normalize({ x: next.x - prev.x, y: next.y - prev.y })
}

export const aiSystem = (track: Track) => {
  return () => {
    world
      .query(Input, AISensors, Velocity, KartConfig, AI, Transform, Progress)
      .updateEach(([input, sensors, velocity, config, ai, transform, progress]) => {
        if (!ai.env) return

        let frameReward = 0
        const nextCpIndex = (progress.currentCheckpoint + 1) % track.checkpoints.length
        const nextCp = track.checkpoints[nextCpIndex]
        const trackFrame = getTrackSignal(transform, velocity, track)

        if (nextCp && trackFrame) {
          const { alignment, lateral } = trackFrame
          const checkpointAngle = angleToPoint(transform, nextCp)
          const speedFactor = clamp(velocity.speed / Math.max(1, config.maxSpeed), 0, 1)
          const distToCp = Math.sqrt((nextCp.x - transform.x) ** 2 + (nextCp.y - transform.y) ** 2)
          const previousDistance = Number.isFinite(progress.lastDistanceToNext)
            ? progress.lastDistanceToNext
            : distToCp
          const progressDelta = previousDistance - distToCp

          // Progress is the only dense positive reward. Heading/centering are
          // useful shaping signals only while the kart is actually moving.
          frameReward += clamp(progressDelta / 55, -0.5, 0.75)
          frameReward += Math.max(0, alignment) * speedFactor * 0.025
          frameReward += Math.max(0, 1 - Math.abs(checkpointAngle) / Math.PI) * speedFactor * 0.015
          frameReward -= Math.abs(lateral) * speedFactor * 0.025
        }

        // A per-step cost removes the incentive to prolong an episode. The
        // low-speed cost cannot be reset by oscillating a few pixels.
        frameReward -= 0.003
        const lowSpeedThreshold = Math.max(20, config.maxSpeed * 0.05)
        if (velocity.speed < lowSpeedThreshold)
          frameReward -= (1 - velocity.speed / lowSpeedThreshold) * 0.025

        frameReward += ai.env.reward

        // 2. Perform Action and Update Policy
        const features = [
          velocity.x / Math.max(1, config.maxSpeed),
          velocity.y / Math.max(1, config.maxSpeed),
          (() => getTrackSignal(transform, velocity, track)?.alignment ?? 0)(),
          (() => getTrackSignal(transform, velocity, track)?.lateral ?? 0)(),
          (() => {
            const nextCp =
              track.checkpoints[(progress.currentCheckpoint + 1) % track.checkpoints.length]
            return nextCp ? Math.sin(angleToPoint(transform, nextCp)) : 0
          })(),
          (() => {
            const nextCp =
              track.checkpoints[(progress.currentCheckpoint + 1) % track.checkpoints.length]
            return nextCp ? Math.cos(angleToPoint(transform, nextCp)) : 0
          })(),
          (() => {
            const nextCpIndex = (progress.currentCheckpoint + 1) % track.checkpoints.length
            const nextCp = track.checkpoints[nextCpIndex]
            if (!nextCp) return 0
            const maxDist = Math.max(
              1,
              Math.hypot(
                track.bounds.maxX - track.bounds.minX,
                track.bounds.maxY - track.bounds.minY,
              ),
            )
            return clamp(
              Math.sqrt((nextCp.x - transform.x) ** 2 + (nextCp.y - transform.y) ** 2) / maxDist,
              0,
              1,
            )
          })(),
          ...sensors.distances.map((d) => d / sensors.maxDistance),
          ...sensors.rearDistances.map((d) => d / sensors.maxDistance),
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
          progress.lastDistanceToNext = Number.POSITIVE_INFINITY
          return
        }

        // 4. Update Inputs from PPO Action
        if (input.source === 'ai' && action) {
          const forward = Math.max(-1, Math.min(1, action[0] ?? 0))
          input.forward = forward
          input.steer = Math.max(-1, Math.min(1, action[1] ?? 0))
        }
      })
  }
}
