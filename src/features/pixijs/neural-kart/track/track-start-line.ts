import type { Track } from './track-types'

/**
 * Start Line logic is primarily handled by the checkpoint system
 * which treats the first node (index 0) as the start/finish line.
 */
export function getStartLinePosition(track: Track) {
  return track.startLine
}
