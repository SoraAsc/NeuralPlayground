import type { Track, TrackGenerator, PathNode } from '../track-types'
import { createTrackFromNodes } from '../track-generator'
import { createRandom } from '@/shared/pixijs/common-math'

export class SnakeTrackGenerator implements TrackGenerator {
  generate(seed: number): Track {
    const random = createRandom(seed)
    const trackWidth = 120
    const nodeCount = 8
    const radius = 600
    const pathNodes: PathNode[] = []

    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2
      const offset = (random() - 0.5) * 400
      const r = radius + offset

      pathNodes.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        width: trackWidth,
        checkpoint: i % 2 === 0,
        order: i,
      })
    }

    return createTrackFromNodes(pathNodes, trackWidth)
  }
}
