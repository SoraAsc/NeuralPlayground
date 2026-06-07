import type { Vector2 } from '@/shared/pixijs/common-types'
import { catmullRom, getNormal, angleTo } from '@/shared/pixijs/common-math'
import type { Track, PathNode, StartLine, SpawnPoint, Checkpoint } from './track-types'
import { generateTrackMask } from './track-mask'

export function createTrackFromNodes(pathNodes: PathNode[], trackWidth: number): Track {
  const centerLine: Vector2[] = []
  const leftBorder: Vector2[] = []
  const rightBorder: Vector2[] = []
  const resolution = 20 // points between nodes

  if (pathNodes.length < 4) {
    throw new Error('Track must have at least 4 nodes for Catmull-Rom')
  }

  // Generate a closed loop of centerLine points
  for (let i = 0; i < pathNodes.length; i++) {
    const p0 = pathNodes[(i - 1 + pathNodes.length) % pathNodes.length]
    const p1 = pathNodes[i]
    const p2 = pathNodes[(i + 1) % pathNodes.length]
    const p3 = pathNodes[(i + 2) % pathNodes.length]

    if (p0 && p1 && p2 && p3) {
      for (let t = 0; t < 1; t += 1 / resolution) {
        const pos = catmullRom(p0, p1, p2, p3, t)
        centerLine.push(pos)
      }
    }
  }

  // Calculate borders based on the closed centerLine
  for (let i = 0; i < centerLine.length; i++) {
    const p1 = centerLine[i]
    const p2 = centerLine[(i + 1) % centerLine.length]

    if (p1 && p2) {
      const normal = getNormal(p1, p2)

      leftBorder.push({
        x: p1.x + normal.x * (trackWidth / 2),
        y: p1.y + normal.y * (trackWidth / 2),
      })
      rightBorder.push({
        x: p1.x - normal.x * (trackWidth / 2),
        y: p1.y - normal.y * (trackWidth / 2),
      })
    }
  }

  // Bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  centerLine.forEach((p) => {
    if (p) {
      minX = Math.min(minX, p.x - trackWidth)
      minY = Math.min(minY, p.y - trackWidth)
      maxX = Math.max(maxX, p.x + trackWidth)
      maxY = Math.max(maxY, p.y + trackWidth)
    }
  })

  // Start Line
  const startNode = pathNodes[0]
  const nextNode = pathNodes[1]
  if (!startNode || !nextNode) {
    throw new Error('Invalid start nodes')
  }

  const startRotation = angleTo(startNode, nextNode)
  const startLine: StartLine = {
    x: startNode.x,
    y: startNode.y,
    rotation: startRotation,
    width: trackWidth,
  }

  // Spawn Points
  const spawnPoints: SpawnPoint[] = []
  const spawnRows = 2
  const spawnCols = 2
  const spawnSpacing = 40

  const startNormal = getNormal(startNode, nextNode)
  const startDir = { x: Math.cos(startRotation), y: Math.sin(startRotation) }

  for (let r = 0; r < spawnRows; r++) {
    for (let c = 0; c < spawnCols; c++) {
      spawnPoints.push({
        x:
          startNode.x -
          startDir.x * (r + 1) * spawnSpacing +
          startNormal.x * (c - 0.5) * spawnSpacing,
        y:
          startNode.y -
          startDir.y * (r + 1) * spawnSpacing +
          startNormal.y * (c - 0.5) * spawnSpacing,
        rotation: startRotation,
      })
    }
  }

  // Checkpoints
  const pointsPerNode = 20
  const checkpoints: Checkpoint[] = pathNodes
    .filter((n) => n.checkpoint)
    .map((n) => {
      const next = pathNodes[(n.order + 1) % pathNodes.length]
      return {
        x: n.x,
        y: n.y,
        index: n.order * pointsPerNode,
        width: trackWidth,
        rotation: next ? angleTo(n, next) : 0,
      }
    })

  const track: Track = {
    pathNodes,
    centerLine,
    leftBorder,
    rightBorder,
    startLine,
    spawnPoints,
    checkpoints,
    roadMask: { width: 0, height: 0, data: new Uint8Array(0), scale: 1 },
    width: trackWidth,
    bounds: { minX, minY, maxX, maxY },
  }

  track.roadMask = generateTrackMask(track)

  return track
}
