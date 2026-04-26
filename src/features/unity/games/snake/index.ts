export interface EpisodePayloadI {
  index: number
  episodes: number
}

export interface StatsPayloadI {
  index: number
  reward: number
  bodySize: number
  bestReward: number
  bestBodySize: number
  realTimeTrained: number
  acceleratedTimeTrained: number
  status: 'stopped' | 'testing' | 'training'
}
