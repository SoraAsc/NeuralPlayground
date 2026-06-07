import { world } from '@/shared/ecs/world'
import { Transform, AISensors } from '../kart/traits'
import { isRoad } from './track-mask'
import type { Track } from './track-types'

export const sensorSystem = (track: Track) => {
  return () => {
    world.query(Transform, AISensors).updateEach(([transform, sensors]) => {
      const { x, y, rotation } = transform
      const { numRays, numRearRays, maxDistance } = sensors

      // Arc of 180 degrees centered at the front
      const distances: number[] = []
      const startAngle = -Math.PI / 2
      const endAngle = Math.PI / 2
      const step = numRays > 1 ? (endAngle - startAngle) / (numRays - 1) : 0

      for (let i = 0; i < numRays; i++) {
        const rayAngle = rotation + startAngle + i * step
        const dirX = Math.cos(rayAngle)
        const dirY = Math.sin(rayAngle)
        let distance = maxDistance

        // Ray marching (simple step-based) - Step size of 5 pixels
        for (let d = 0; d < maxDistance; d += 5) {
          if (!isRoad(track, x + dirX * d, y + dirY * d)) {
            distance = d
            break
          }
        }
        distances.push(distance)
      }

      // Arc of 90 degrees centered at the rear
      const rearDistances: number[] = []
      const rearHalfArc = Math.PI / 4 // 45 for each side
      const rearStep = numRearRays > 1 ? (rearHalfArc * 2) / (numRearRays - 1) : 0

      for (let i = 0; i < numRearRays; i++) {
        const rayAngle = rotation + Math.PI - rearHalfArc + i * rearStep
        const dirX = Math.cos(rayAngle)
        const dirY = Math.sin(rayAngle)
        let distance = maxDistance

        // Ray marching (simple step-based) - Step size of 5 pixels
        for (let d = 0; d < maxDistance; d += 5) {
          if (!isRoad(track, x + dirX * d, y + dirY * d)) {
            distance = d
            break
          }
        }
        rearDistances.push(distance)
      }
      sensors.distances = distances
      sensors.rearDistances = rearDistances
    })
  }
}
