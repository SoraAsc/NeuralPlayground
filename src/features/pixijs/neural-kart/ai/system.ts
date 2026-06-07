import { world } from '@/shared/ecs/world'
import { Input, AISensors, Velocity } from '../kart/traits'

export function aiSystem() {
  world.query(Input, AISensors, Velocity).updateEach(([input, sensors, velocity]) => {
    if (input.source !== 'ai') return

    // Features (inputs for NN):
    const features = [
      ...sensors.distances.map((d: number) => d / sensors.maxDistance),
      velocity.speed / 400,
    ]

    console.log('AI Features:', features)
  })
}
