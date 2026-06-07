import type { Vector2 } from '@/shared/pixijs/common-types'

export function distance(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function distanceSq(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return dx * dx + dy * dy
}

export function normalize(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

export function perpendicular(v: Vector2): Vector2 {
  return { x: -v.y, y: v.x }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpVec(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

// Angle Between two points
export function angleTo(from: Vector2, to: Vector2): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

export function dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y
}

export function cross(a: Vector2, b: Vector2): number {
  return a.x * b.y - a.y * b.x
}

export function catmullRom(
  p0: Vector2,
  p1: Vector2,
  p2: Vector2,
  p3: Vector2,
  t: number
): Vector2 {
  const t2 = t * t
  const t3 = t2 * t

  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

export function segmentsIntersect(
  a: Vector2,
  b: Vector2,
  c: Vector2,
  d: Vector2
): boolean {
  const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (det === 0) return false

  const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det
  const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det
  return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1
}

export function getNormal(a: Vector2, b: Vector2): Vector2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return normalize({ x: -dy, y: dx })
}

export function createRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function findNearestPoint(p: Vector2, points: Vector2[]): Vector2 {
  if (points.length === 0) return { x: 0, y: 0 }
  let minDistSq = Infinity
  let nearest = points[0] as Vector2
  for (const pt of points) {
    const dSq = distanceSq(p, pt)
    if (dSq < minDistSq) {
      minDistSq = dSq
      nearest = pt
    }
  }
  return nearest
}
