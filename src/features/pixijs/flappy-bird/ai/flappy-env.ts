import { createNNW, type NeuralNetwork, type PPOAgent } from 'nnw'

const CHECKPOINT_URL = '/models/flappy-bird.nnw'
const NUM_ENVS = 12
const STATE_SIZE = 6
const ROLLOUT_STEPS = 128
const DT = 0.02
const WIDTH = 800
const HEIGHT = 500
const BIRD_X = 180
const PIPE_WIDTH = 72
const PIPE_GAP = 155
const PIPE_SPEED = 135
const GRAVITY = 1050
const FLAP_VELOCITY = -360
const MIN_GAP_Y = PIPE_GAP / 2 + 35
const MAX_GAP_Y = HEIGHT - MIN_GAP_Y

type BirdEnvironment = {
  y: number
  velocity: number
  pipes: FlappyPipe[]
  episodeReward: number
  score: number
  survival: number
}

export type FlappyPipe = {
  x: number
  gapY: number
  passed: boolean
  verticalDirection: -1 | 1
}

export type FlappySnapshot = BirdEnvironment & {
  index: number
  opacity: number
}

const randomGap = () => MIN_GAP_Y + Math.random() * (MAX_GAP_Y - MIN_GAP_Y)
const randomSpacing = () => 250 + Math.random() * 180

export class FlappyPPOEnvironment {
  private nnw!: Awaited<ReturnType<typeof createNNW>>
  private actor!: NeuralNetwork
  private critic!: NeuralNetwork
  private agent!: PPOAgent
  private envs: BirdEnvironment[] = []
  private rolloutSteps = 0

  episodes = 0
  bestReward = Number.NEGATIVE_INFINITY
  bestScore = 0
  lastReward = 0
  rewardHistory: number[] = []
  scoreHistory: number[] = []
  autoLoadedCheckpoint = false
  movingPipes = false
  pipeVerticalSpeed = 20

  async init() {
    this.nnw = await createNNW()
    this.actor = this.nnw
      .createModel(STATE_SIZE)
      .addDense(128, 'tanh')
      .addDense(128, 'tanh')
      .addDense(2, 'linear')
    this.critic = this.nnw
      .createModel(STATE_SIZE)
      .addDense(128, 'tanh')
      .addDense(128, 'tanh')
      .addDense(1, 'linear')
    await this.tryLoadPublishedCheckpoint()
    this.createAgent()
    this.envs = Array.from({ length: NUM_ENVS }, (_, index) => this.createEnvironment(index))
  }

  tick() {
    const states = this.envs.flatMap((env) => this.getState(env))
    const { actions, logProbs, values } = this.agent.collectStep(states, NUM_ENVS)
    const rewards = new Array<number>(NUM_ENVS)
    const dones = new Array<number>(NUM_ENVS)

    this.envs.forEach((env, index) => {
      const action = Math.round(actions[index] ?? 0)
      const { reward, done } = this.stepEnvironment(env, action)
      rewards[index] = reward
      dones[index] = done ? 1 : 0
      env.episodeReward += reward

      if (done) {
        this.completeEpisode(env)
        this.resetEnvironment(env, index)
      }
    })

    this.agent.storeTransition(states, NUM_ENVS, actions, logProbs, rewards, dones, values)
    this.rolloutSteps++

    if (this.rolloutSteps >= ROLLOUT_STEPS) {
      const nextStates = this.envs.flatMap((env) => this.getState(env))
      const bootstrap = this.agent.collectStep(nextStates, NUM_ENVS).values
      this.agent.train(
        bootstrap.map((value, index) => (dones[index] ? 0 : value)),
        dones,
      )
      this.rolloutSteps = 0
    }
  }

  snapshots(): FlappySnapshot[] {
    const ranked = [...this.envs].sort(
      (a, b) => b.episodeReward - a.episodeReward || b.survival - a.survival,
    )
    const ranks = new Map(ranked.map((env, index) => [env, index]))
    return this.envs.map((env, index) => ({
      ...env,
      index,
      opacity: 0.2 + (1 - (ranks.get(env) ?? 0) / Math.max(1, NUM_ENVS - 1)) * 0.8,
    }))
  }

  setPipeMotion(enabled: boolean, speed: number) {
    this.movingPipes = enabled
    this.pipeVerticalSpeed = Math.max(5, Math.min(45, speed))
  }

  leader() {
    return this.snapshots().reduce((best, bird) =>
      bird.episodeReward > best.episodeReward ||
      (bird.episodeReward === best.episodeReward && bird.survival > best.survival)
        ? bird
        : best,
    )
  }

  exportCheckpoint() {
    return this.nnw.saveCheckpoint(this.models())
  }

  importCheckpoint(buffer: ArrayBuffer) {
    this.agent?.dispose()
    this.nnw.loadCheckpoint(buffer, this.models())
    this.createAgent()
    this.resetSession()
  }

  resetLearning() {
    this.agent?.dispose()
    this.nnw.resetModels(this.models())
    this.createAgent()
    this.resetSession()
  }

  private createAgent() {
    this.agent = this.nnw.createPPOAgent(this.actor, this.critic, {
      actionSpace: 'discrete',
      optimizer: 'adamw',
      numEnvs: NUM_ENVS,
      rolloutSteps: ROLLOUT_STEPS,
      minibatchSize: 256,
      learningRate: 3e-4,
      gamma: 0.99,
      gaeLambda: 0.95,
      clipRange: 0.2,
      valueLossCoef: 0.5,
      entropyCoef: 0.01,
      maxGradNorm: 0.5,
      epochs: 4,
    })
  }

  private createEnvironment(index: number): BirdEnvironment {
    const firstPipeX = 350 + Math.random() * 210 + (index / NUM_ENVS) * 20
    const pipes: FlappyPipe[] = []
    let pipeX = firstPipeX
    for (let i = 0; i < 4; i++) {
      pipes.push({
        x: pipeX,
        gapY: randomGap(),
        passed: false,
        verticalDirection: Math.random() < 0.5 ? -1 : 1,
      })
      pipeX += randomSpacing()
    }
    return {
      y: HEIGHT * (0.45 + Math.random() * 0.1),
      velocity: 0,
      pipes,
      episodeReward: 0,
      score: 0,
      survival: 0,
    }
  }

  private resetEnvironment(env: BirdEnvironment, index: number) {
    Object.assign(env, this.createEnvironment(index))
  }

  private getState(env: BirdEnvironment) {
    const nextPipe = this.nextPipe(env)
    return [
      (env.y / HEIGHT) * 2 - 1,
      Math.max(-1, Math.min(1, env.velocity / 500)),
      Math.max(-1, Math.min(1, (nextPipe.x - BIRD_X) / WIDTH)),
      (nextPipe.gapY / HEIGHT) * 2 - 1,
      Math.max(-1, Math.min(1, (nextPipe.gapY - env.y) / HEIGHT)),
      this.movingPipes ? (nextPipe.verticalDirection * this.pipeVerticalSpeed) / 45 : 0,
    ]
  }

  private stepEnvironment(env: BirdEnvironment, action: number) {
    if (action === 1) env.velocity = FLAP_VELOCITY
    env.velocity += GRAVITY * DT
    env.y += env.velocity * DT
    for (const pipe of env.pipes) {
      pipe.x -= PIPE_SPEED * DT
      if (this.movingPipes) {
        pipe.gapY += pipe.verticalDirection * this.pipeVerticalSpeed * DT
        if (pipe.gapY <= MIN_GAP_Y || pipe.gapY >= MAX_GAP_Y) {
          pipe.gapY = Math.max(MIN_GAP_Y, Math.min(MAX_GAP_Y, pipe.gapY))
          pipe.verticalDirection = pipe.verticalDirection === 1 ? -1 : 1
        }
      }
    }
    env.survival += DT

    let reward = 0.01
    for (const pipe of env.pipes) {
      if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
        pipe.passed = true
        env.score++
        reward += 1
      }
    }

    const firstPipe = env.pipes[0]
    if (firstPipe && firstPipe.x + PIPE_WIDTH < 0) {
      env.pipes.shift()
      const lastX = env.pipes.at(-1)?.x ?? WIDTH
      env.pipes.push({
        x: lastX + randomSpacing(),
        gapY: randomGap(),
        passed: false,
        verticalDirection: Math.random() < 0.5 ? -1 : 1,
      })
    }

    const hitPipe = env.pipes.some((pipe) => {
      const overlaps = BIRD_X + 13 > pipe.x && BIRD_X - 13 < pipe.x + PIPE_WIDTH
      const outsideGap =
        env.y - 13 < pipe.gapY - PIPE_GAP / 2 || env.y + 13 > pipe.gapY + PIPE_GAP / 2
      return overlaps && outsideGap
    })
    const done = env.y < 13 || env.y > HEIGHT - 13 || hitPipe
    if (done) reward -= 1
    return { reward, done }
  }

  private nextPipe(env: BirdEnvironment) {
    return env.pipes.find((pipe) => pipe.x + PIPE_WIDTH >= BIRD_X) ?? env.pipes[0]!
  }

  private completeEpisode(env: BirdEnvironment) {
    this.episodes++
    this.lastReward = env.episodeReward
    this.bestReward = Math.max(this.bestReward, env.episodeReward)
    this.bestScore = Math.max(this.bestScore, env.score)
    this.rewardHistory.push(env.episodeReward)
    if (this.rewardHistory.length > 200) this.rewardHistory.shift()
    this.scoreHistory.push(env.score)
    if (this.scoreHistory.length > 200) this.scoreHistory.shift()
  }

  private resetSession() {
    this.rolloutSteps = 0
    this.episodes = 0
    this.lastReward = 0
    this.bestReward = Number.NEGATIVE_INFINITY
    this.bestScore = 0
    this.rewardHistory = []
    this.scoreHistory = []
    this.envs = Array.from({ length: NUM_ENVS }, (_, index) => this.createEnvironment(index))
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
    } catch (error) {
      console.warn('Flappy Bird: não foi possível carregar o checkpoint publicado', error)
    }
  }

  dispose() {
    this.agent?.dispose()
    this.actor?.dispose()
    this.critic?.dispose()
  }
}

export const FLAPPY_WORLD = {
  width: WIDTH,
  height: HEIGHT,
  birdX: BIRD_X,
  pipeWidth: PIPE_WIDTH,
  pipeGap: PIPE_GAP,
  numEnvs: NUM_ENVS,
}
