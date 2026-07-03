import { createNNW, type PPOAgent, type NeuralNetwork } from 'nnw'

const nnwPromise = createNNW()

type PendingStep = {
  state: number[]
  action: number[]
  logProbs: number[]
  values: number[]
}

export class NeuralKartEnvironment {
  private inputSize: number
  private outputSize: number
  private rolloutSteps: number
  public inputs: number[] = []
  public outputs: number[] = []
  public reward = 0
  public lastReward = 0
  public totalReward = 0
  public done = false

  private nnw: Awaited<ReturnType<typeof createNNW>> | null = null
  private actor: NeuralNetwork | null = null
  private critic: NeuralNetwork | null = null
  private agent: PPOAgent | null = null
  private pendingStep: PendingStep | null = null
  private stepsSinceTrain = 0
  private disposed = false

  private constructor(inputSize: number, outputSize: number, rolloutSteps: number) {
    this.inputSize = inputSize
    this.outputSize = outputSize
    this.rolloutSteps = rolloutSteps
    this.reset()
  }

  static async create(inputSize: number, outputSize: number) {
    const env = new NeuralKartEnvironment(inputSize, outputSize, 32)
    await env.init()
    return env
  }

  private async init() {
    this.nnw = await nnwPromise

    this.actor = this.nnw
      .createModel(this.inputSize)
      .addDense(64, 'tanh')
      .addDense(64, 'tanh')
      .addDense(this.outputSize, 'tanh')

    this.critic = this.nnw
      .createModel(this.inputSize)
      .addDense(64, 'tanh')
      .addDense(64, 'tanh')
      .addDense(1, 'linear')

    this.agent = this.nnw.createPPOAgent(this.actor, this.critic, {
      actionSpace: 'continuous',
      optimizer: 'adamw',
      numEnvs: 1,
      rolloutSteps: this.rolloutSteps,
      minibatchSize: 1,
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

  reset(): number[] {
    this.inputs = Array.from({ length: this.inputSize }, () => 0)
    this.outputs = Array.from({ length: this.outputSize }, () => 0)
    this.reward = 0
    this.lastReward = 0
    this.totalReward = 0
    this.done = false
    return this.outputs
  }

  step(inputs: number[], reward: number, done: boolean) {
    if (this.disposed) return null
    if (!this.agent) return null

    this.inputs = inputs.slice(0, this.inputSize)
    this.done = done
    const totalReward = reward + this.reward

    if (this.pendingStep) {
      this.agent.storeTransition(
        this.pendingStep.state,
        1,
        this.pendingStep.action,
        this.pendingStep.logProbs,
        [totalReward],
        [done ? 1 : 0],
        this.pendingStep.values,
      )

      this.lastReward = totalReward
      this.totalReward += totalReward
      this.stepsSinceTrain += 1

      if (this.stepsSinceTrain >= this.rolloutSteps) {
        const bootstrap = done ? [0] : this.agent.collectStep(this.inputs, 1).values
        this.agent.train(bootstrap, [done ? 1 : 0])
        this.stepsSinceTrain = 0
      }
    }

    if (done) {
      this.pendingStep = null
      this.outputs = Array.from({ length: this.outputSize }, () => 0)
      return null
    }

    const { actions, logProbs, values } = this.agent.collectStep(this.inputs, 1)
    const action = actions.slice(0, this.outputSize)
    this.reward = 0

    this.pendingStep = {
      state: this.inputs.slice(),
      action,
      logProbs,
      values,
    }

    this.outputs = action.slice()
    return action
  }

  isDone(): boolean {
    return this.done
  }

  dispose() {
    if (this.disposed) return

    this.agent?.dispose()
    this.actor?.dispose()
    this.critic?.dispose()

    this.agent = null
    this.actor = null
    this.critic = null
    this.nnw = null
    this.pendingStep = null
    this.disposed = true
  }
}
