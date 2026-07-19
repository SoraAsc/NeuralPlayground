export type TrainingMode = 'training' | 'evaluation' | 'paused'

/**
 * Small cross-environment contract used by the shared training UI.
 * Game-specific measurements should remain alongside this object.
 */
export type TrainingMetrics = {
  episodes: number
  currentResult: number
  bestResult: number
  history: number[]
  mode: TrainingMode
  stepsPerFrame: number
}
