import { world } from '@/shared/ecs/world'
import { Input, AISensors, Velocity, KartConfig } from '../kart/traits'

export function aiSystem() {
  world
    .query(Input, AISensors, Velocity, KartConfig)
    .updateEach(([input, sensors, velocity, config]) => {
      if (input.source !== 'ai') return
      // Features (inputs for NN):
      const features = [
        ...sensors.distances.map((d) => d / sensors.maxDistance),
        ...sensors.rearDistances.map((d) => d / sensors.maxDistance),
        velocity.speed / config.maxSpeed,
      ]

      console.log('AI Features:', features)
    })
}
