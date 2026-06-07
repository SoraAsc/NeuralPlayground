import type { Track, TrackGenerator, PathNode } from '../track-types'
import { createTrackFromNodes } from '../track-generator'

export class OvalTrackGenerator implements TrackGenerator {
  generate(_seed: number): Track {
    const width = 1200
    const height = 800
    const centerX = 0
    const centerY = 0
    const trackWidth = 150

    const pathNodes: PathNode[] = [
      { x: centerX - width / 2, y: centerY - height / 2, width: trackWidth, checkpoint: true, order: 0 },
      { x: centerX + width / 2, y: centerY - height / 2, width: trackWidth, checkpoint: false, order: 1 },
      { x: centerX + width / 2, y: centerY + height / 2, width: trackWidth, checkpoint: true, order: 2 },
      { x: centerX - width / 2, y: centerY + height / 2, width: trackWidth, checkpoint: false, order: 3 },
    ]

    return createTrackFromNodes(pathNodes, trackWidth)
  }
}
