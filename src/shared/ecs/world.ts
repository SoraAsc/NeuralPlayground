import { createWorld, relation } from 'koota'

export const world = createWorld()

export const InSimulation = relation({ autoDestroy: 'source' })
