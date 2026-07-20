import type { Vector2 } from '@/shared/pixijs/common-types'

export interface PathNode {
  x: number
  y: number
  width: number
  checkpoint: boolean
  order: number
}

export interface TrackMask {
  width: number
  height: number
  data: Uint8Array
  scale: number // World units represented by one mask cell
}

export interface StartLine {
  x: number
  y: number
  rotation: number
  width: number
}

export interface SpawnPoint {
  x: number
  y: number
  rotation: number
}

export interface Checkpoint {
  x: number
  y: number
  index: number
  width: number
  rotation: number
}

export interface Track {
  pathNodes: PathNode[]
  centerLine: Vector2[]
  leftBorder: Vector2[]
  rightBorder: Vector2[]
  startLine: StartLine
  spawnPoints: SpawnPoint[]
  checkpoints: Checkpoint[]
  roadMask: TrackMask
  width: number
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

export interface TrackGenerator {
  generate(seed: number): Track
}
