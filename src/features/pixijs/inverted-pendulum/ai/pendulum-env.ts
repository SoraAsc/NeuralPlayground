import { createNNW, type NeuralNetwork, type PPOAgent } from 'nnw'

type PendingStep = {
  state: number[]
  action: number[]
  logProbs: number[]
  values: number[]
}

// CartPole-v1 reference constants. The only intentional difference is that
// force direction is continuous in [-1, 1], rather than Discrete(2).
const GRAVITY = 9.8
const CART_MASS = 1
const POLE_MASS = 0.1
const TOTAL_MASS = CART_MASS + POLE_MASS
const HALF_POLE_LENGTH = 0.5
const POLE_MASS_LENGTH = POLE_MASS * HALF_POLE_LENGTH
const FORCE_MAGNITUDE = 10
const TAU = 0.02
const ANGLE_THRESHOLD = (12 * 2 * Math.PI) / 360
const POSITION_THRESHOLD = 2.4
const INPUT_SIZE = 4
const ROLLOUT_STEPS = 128
const CHECKPOINT_URL = '/models/inverted-pendulum.nnw'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const randomInitialState = () => Math.random() * 0.1 - 0.05

export class PendulumEnvironment {
  private nnw!: Awaited<ReturnType<typeof createNNW>>
  private actor!: NeuralNetwork
  private critic!: NeuralNetwork
  private agent!: PPOAgent
  private pending: PendingStep | null = null
  private rolloutSteps = 0
  private episodeSteps = 0

  cartPosition = 0
  cartVelocity = 0
  theta = 0
  angularVelocity = 0
  force = 0
  episodeReward = 0
  lastReward = 0
  bestReward = Number.NEGATIVE_INFINITY
  stability = 0
  bestStability = 0
  episodes = 0
  rewardHistory: number[] = []
  stabilityHistory: number[] = []
  autoLoadedCheckpoint = false

  async init() {
    this.nnw = await createNNW()
    this.actor = this.nnw
      .createModel(INPUT_SIZE)
      .addDense(64, 'tanh')
      .addDense(64, 'tanh')
      .addDense(1, 'linear')
    this.critic = this.nnw
      .createModel(INPUT_SIZE)
      .addDense(64, 'tanh')
      .addDense(64, 'tanh')
      .addDense(1, 'linear')
    await this.tryLoadPublishedCheckpoint()
    this.createAgent()
    this.resetEpisode()
  }

  tick() {
    const done = this.isTerminated()
    let state = this.getState()

    if (this.pending) {
      // CartPole-v1 awards +1 for every step, including the terminal step.
      this.agent.storeTransition(
        this.pending.state,
        1,
        this.pending.action,
        this.pending.logProbs,
        [1],
        [done ? 1 : 0],
        this.pending.values,
      )
      this.episodeReward += 1
      this.rolloutSteps++

      if (this.rolloutSteps >= ROLLOUT_STEPS) {
        const bootstrap = done ? [0] : this.agent.collectStep(state, 1).values
        this.agent.train(bootstrap, [done ? 1 : 0])
        this.rolloutSteps = 0
      }
    }

    if (done) {
      this.completeEpisode()
      this.resetEpisode()
      state = this.getState()
    }

    const { actions, logProbs, values } = this.agent.collectStep(state, 1)
    const sampledAction = actions[0] ?? 0
    const appliedAction = clamp(sampledAction, -1, 1)
    this.pending = { state, action: [sampledAction], logProbs, values }
    this.applyPhysics(appliedAction)
  }

  resetLearning() {
    this.agent?.dispose()
    this.nnw.resetModels({ actor: this.actor, critic: this.critic })
    this.createAgent()
    this.pending = null
    this.rolloutSteps = 0
    this.resetStatistics()
    this.resetEpisode()
  }

  exportCheckpoint() {
    return this.nnw.saveCheckpoint(this.models())
  }

  importCheckpoint(buffer: ArrayBuffer) {
    this.agent?.dispose()
    this.nnw.loadCheckpoint(buffer, this.models())
    this.createAgent()
    this.pending = null
    this.rolloutSteps = 0
    this.resetStatistics()
    this.resetEpisode()
  }

  private models() {
    return { actor: this.actor, critic: this.critic }
  }

  private async tryLoadPublishedCheckpoint() {
    try {
      const response = await fetch(CHECKPOINT_URL, { cache: 'no-store' })
      if (!response.ok) return
      this.nnw.loadCheckpoint(await response.arrayBuffer(), this.models())
      this.autoLoadedCheckpoint = true
      console.info(`Pêndulo invertido: checkpoint carregado de ${CHECKPOINT_URL}`)
    } catch (error) {
      console.warn('Pêndulo invertido: não foi possível carregar o checkpoint publicado', error)
    }
  }

  private resetStatistics() {
    this.episodes = 0
    this.lastReward = 0
    this.bestReward = Number.NEGATIVE_INFINITY
    this.bestStability = 0
    this.rewardHistory = []
    this.stabilityHistory = []
  }

  private createAgent() {
    this.agent = this.nnw.createPPOAgent(this.actor, this.critic, {
      actionSpace: 'continuous',
      optimizer: 'adamw',
      numEnvs: 1,
      rolloutSteps: ROLLOUT_STEPS,
      minibatchSize: 64,
      learningRate: 3e-4,
      gamma: 0.99,
      gaeLambda: 0.95,
      clipRange: 0.2,
      valueLossCoef: 0.5,
      entropyCoef: 0.005,
      maxGradNorm: 0.5,
      epochs: 4,
    })
  }

  private getState() {
    // Same observation order and raw units as CartPole-v1.
    return [this.cartPosition, this.cartVelocity, this.theta, this.angularVelocity]
  }

  private applyPhysics(action: number) {
    this.force = action * FORCE_MAGNITUDE
    const cosTheta = Math.cos(this.theta)
    const sinTheta = Math.sin(this.theta)
    const temp = (this.force + POLE_MASS_LENGTH * this.angularVelocity ** 2 * sinTheta) / TOTAL_MASS
    const angularAcceleration =
      (GRAVITY * sinTheta - cosTheta * temp) /
      (HALF_POLE_LENGTH * (4 / 3 - (POLE_MASS * cosTheta ** 2) / TOTAL_MASS))
    const cartAcceleration = temp - (POLE_MASS_LENGTH * angularAcceleration * cosTheta) / TOTAL_MASS

    // Explicit Euler, matching the default CartPole-v1 integrator.
    this.cartPosition += TAU * this.cartVelocity
    this.cartVelocity += TAU * cartAcceleration
    this.theta += TAU * this.angularVelocity
    this.angularVelocity += TAU * angularAcceleration
    this.episodeSteps++
    this.stability = this.episodeSteps * TAU
    this.bestStability = Math.max(this.bestStability, this.stability)
  }

  private isTerminated() {
    return (
      this.cartPosition < -POSITION_THRESHOLD ||
      this.cartPosition > POSITION_THRESHOLD ||
      this.theta < -ANGLE_THRESHOLD ||
      this.theta > ANGLE_THRESHOLD
    )
  }

  private completeEpisode() {
    this.episodes++
    this.lastReward = this.episodeReward
    this.bestReward = Math.max(this.bestReward, this.episodeReward)
    this.rewardHistory.push(this.episodeReward)
    if (this.rewardHistory.length > 200) this.rewardHistory.shift()
    this.stabilityHistory.push(this.stability)
    if (this.stabilityHistory.length > 200) this.stabilityHistory.shift()
  }

  private resetEpisode() {
    this.cartPosition = randomInitialState()
    this.cartVelocity = randomInitialState()
    this.theta = randomInitialState()
    this.angularVelocity = randomInitialState()
    this.force = 0
    this.episodeSteps = 0
    this.episodeReward = 0
    this.stability = 0
  }

  dispose() {
    this.agent?.dispose()
    this.actor?.dispose()
    this.critic?.dispose()
  }
}
