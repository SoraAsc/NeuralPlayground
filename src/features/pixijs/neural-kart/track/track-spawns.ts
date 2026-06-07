import type { Entity } from 'koota'
import { Transform } from '../kart/traits'
import type { Track } from './track-types'

export function spawnKarts(track: Track, kartEntities: Entity[]) {
  const spawns = track.spawnPoints

  kartEntities.forEach((entity, i) => {
    const spawn = spawns[i % spawns.length]
    if (!spawn) return

    if (entity.has(Transform)) {
      entity.set(Transform, {
        x: spawn.x,
        y: spawn.y,
        rotation: spawn.rotation,
      })
    }
  })
}
