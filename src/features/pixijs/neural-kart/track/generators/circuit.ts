import type { Track, TrackGenerator, PathNode } from '../track-types'
import { createTrackFromNodes } from '../track-generator'
import { createRandom } from '@/shared/pixijs/common-math'

export class CircuitTrackGenerator implements TrackGenerator {
  generate(seed: number): Track {
    const random = createRandom(seed)
    const trackWidth = 140
    const nodeCount = 10
    const pathNodes: PathNode[] = []

    // Generate a base circle then perturb it
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2
      const baseRadius = 700
      const perturb = (random() - 0.5) * 300

      pathNodes.push({
        x: Math.cos(angle) * (baseRadius + perturb),
        y: Math.sin(angle) * (baseRadius + perturb),
        width: trackWidth,
        checkpoint: i % 3 === 0,
        order: i,
      })
    }

    return createTrackFromNodes(pathNodes, trackWidth)
  }
}
