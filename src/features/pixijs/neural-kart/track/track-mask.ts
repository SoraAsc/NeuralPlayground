import type { Vector2 } from '@/shared/pixijs/common-types'
import { distanceSq } from '@/shared/pixijs/common-math'
import type { Track, TrackMask } from './track-types'

export function generateTrackMask(track: Track, resolution = 10): TrackMask {
  const { minX, minY, maxX, maxY } = track.bounds
  const width = Math.ceil((maxX - minX) / resolution)
  const height = Math.ceil((maxY - minY) / resolution)

  const data = new Uint8Array(width * height)
  const halfWidthSq = (track.width / 2) * (track.width / 2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const worldX = minX + x * resolution
      const worldY = minY + y * resolution

      const point: Vector2 = { x: worldX, y: worldY }

      // Check distance to all segments of centerLine
      let onRoad = false
      for (let i = 0; i < track.centerLine.length; i++) {
        const p = track.centerLine[i]
        if (p && distanceSq(point, p) < halfWidthSq) {
          onRoad = true
          break
        }
      }

      if (onRoad) data[y * width + x] = 1
    }
  }

  return {
    width,
    height,
    data,
    scale: resolution,
  }
}

export function isRoad(track: Track, x: number, y: number): boolean {
  const mask = track.roadMask
  const { minX, minY } = track.bounds

  const maskX = Math.floor((x - minX) / mask.scale)
  const maskY = Math.floor((y - minY) / mask.scale)

  if (maskX < 0 || maskX >= mask.width || maskY < 0 || maskY >= mask.height) {
    return false
  }

  return mask.data[maskY * mask.width + maskX] === 1
}
