import { world } from '@/shared/ecs/world'
import { Transform, AISensors } from '../kart/traits'
import { isRoad } from './track-mask'
import type { Track } from './track-types'

export const sensorSystem = (track: Track) => {
  return () => {
    world.query(Transform, AISensors).updateEach(([transform, sensors]) => {
      const { x, y, rotation } = transform
      const { numRays, maxDistance } = sensors

      const distances: number[] = []

      // Arc of 180 degrees centered at the front
      const startAngle = -Math.PI / 2
      const endAngle = Math.PI / 2
      const step = numRays > 1 ? (endAngle - startAngle) / (numRays - 1) : 0

      for (let i = 0; i < numRays; i++) {
        const rayAngle = rotation + startAngle + i * step
        const dirX = Math.cos(rayAngle)
        const dirY = Math.sin(rayAngle)

        let distance = maxDistance

        // Ray marching (simple step-based)
        // Step size of 5 pixels for performance, can be refined
        for (let d = 0; d < maxDistance; d += 5) {
          const checkX = x + dirX * d
          const checkY = y + dirY * d

          if (!isRoad(track, checkX, checkY)) {
            distance = d
            break
          }
        }

        distances.push(distance)
      }

      sensors.distances = distances
    })
  }
}
