import type { Track, TrackGenerator, PathNode } from '../track-types'
import { createTrackFromNodes } from '../track-generator'
import { createRandom } from '@/shared/pixijs/common-math'

export class CrazyTrackGenerator implements TrackGenerator {
  generate(seed: number): Track {
    const random = createRandom(seed)
    const trackWidth = 100
    const nodeCount = 12
    const pathNodes: PathNode[] = []

    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2
      const baseRadius = 800
      // Large perturbations for crazy layouts
      const perturb = (random() - 0.5) * 600

      pathNodes.push({
        x: Math.cos(angle) * (baseRadius + perturb),
        y: Math.sin(angle) * (baseRadius + perturb),
        width: trackWidth,
        checkpoint: i % 2 === 0,
        order: i,
      })
    }
    return createTrackFromNodes(pathNodes, trackWidth)
  }
}
