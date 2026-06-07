export * from './factory'
import { createKart, type KartType } from './factory'

export async function spawnKart(
  x: number,
  y: number,
  rotation: number = 0,
  type: KartType = 'sport',
  source: 'manual' | 'ai' = 'manual',
) {
  return createKart(type, x, y, rotation, source)
}
