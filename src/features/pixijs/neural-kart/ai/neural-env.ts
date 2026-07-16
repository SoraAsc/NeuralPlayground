import { createNNW, type PPOAgent, type NeuralNetwork } from 'nnw'

type PendingStep = {
  state: number[]
  action: number[]
  logProbs: number[]
  values: number[]
}

const CHECKPOINT_URL = '/models/neural-kart.nnw'

/**
 * Unique PPO Agent, shared between all the karts
 */
class SharedAgent {
  private static promise: Promise<SharedAgent> | null = null

  nnw!: Awaited<ReturnType<typeof createNNW>>
  actor!: NeuralNetwork
  critic!: NeuralNetwork
  agent!: PPOAgent
  activeEnvs = 0
  version = 0
  private stepsSinceTrain = 0

  private constructor(
    private inputSize: number,
    private outputSize: number,
    private rolloutSteps: number,
  ) {}

  static async get(inputSize: number, outputSize: number, rolloutSteps = 512) {
    if (!this.promise) {
      this.promise = (async () => {
        const shared = new SharedAgent(inputSize, outputSize, rolloutSteps)
        await shared.init()
        return shared
      })()
    }
    return this.promise
  }

  static reset() {
    this.promise = null
  }

  private async init() {
    this.nnw = await createNNW()

    this.actor = this.nnw
      .createModel(this.inputSize)
      .addDense(128, 'tanh')
      .addDense(128, 'tanh')
      .addDense(128, 'tanh')
      .addDense(this.outputSize, 'linear')

    this.critic = this.nnw
      .createModel(this.inputSize)
      .addDense(128, 'tanh')
      .addDense(128, 'tanh')
      .addDense(128, 'tanh')
      .addDense(1, 'linear')

    await this.tryLoadPublishedCheckpoint()
    this.createAgent()
  }

  private createAgent() {
    this.agent = this.nnw.createPPOAgent(this.actor, this.critic, {
      actionSpace: 'continuous',
      optimizer: 'adamw',
      numEnvs: 1,
      rolloutSteps: this.rolloutSteps,
      minibatchSize: 128,
      learningRate: 5e-5,
      gamma: 0.99,
      gaeLambda: 0.95,
      clipRange: 0.2,
      valueLossCoef: 0.5,
      entropyCoef: 0.005,
      maxGradNorm: 0.5,
      epochs: 2,
    })
  }

  private async tryLoadPublishedCheckpoint() {
    try {
      const response = await fetch(CHECKPOINT_URL, { cache: 'no-store' })
      if (!response.ok) return
      this.nnw.loadCheckpoint(await response.arrayBuffer(), this.models())
      console.info(`Neural Kart: checkpoint carregado de ${CHECKPOINT_URL}`)
    } catch (error) {
      console.warn('Neural Kart: não foi possível carregar o checkpoint publicado', error)
    }
  }

  exportCheckpoint(): ArrayBuffer {
    return this.nnw.saveCheckpoint(this.models())
  }

  importCheckpoint(buffer: ArrayBuffer, restartAgent = true) {
    this.nnw.loadCheckpoint(buffer, this.models())
    if (restartAgent) this.restartAgent()
  }

  resetFromScratch() {
    this.nnw.resetModels(this.models())
    this.restartAgent()
  }

  private models() {
    return { actor: this.actor, critic: this.critic }
  }

  private restartAgent() {
    if (this.agent) this.agent.dispose()
    this.createAgent()
    this.stepsSinceTrain = 0
    this.version += 1
  }

  /** Called after each storeTransition */
  maybeTrain(bootstrapState: number[], done: boolean) {
    this.stepsSinceTrain += 1
    if (this.stepsSinceTrain < this.rolloutSteps) return
    const bootstrap = done ? [0] : this.agent.collectStep(bootstrapState, 1).values
    this.agent.train(bootstrap, [done ? 1 : 0])
    this.stepsSinceTrain = 0
  }

  dispose() {
    this.agent?.dispose()
    this.actor?.dispose()
    this.critic?.dispose()
  }
}

export class NeuralKartEnvironment {
  private inputSize: number
  private outputSize: number
  public inputs: number[] = []
  public outputs: number[] = []
  public reward = 0
  public lastReward = 0
  public totalReward = 0
  public done = false

  private shared: SharedAgent | null = null
  private pendingStep: PendingStep | null = null
  private disposed = false
  private sharedVersion = 0

  private constructor(inputSize: number, outputSize: number) {
    this.inputSize = inputSize
    this.outputSize = outputSize
    this.reset()
  }

  static async create(inputSize: number, outputSize: number) {
    const env = new NeuralKartEnvironment(inputSize, outputSize)
    await env.init()
    return env
  }

  static disposeShared() {
    SharedAgent['promise']?.then((s) => s.dispose())
    SharedAgent.reset()
  }

  static async exportSharedCheckpoint() {
    const shared = await SharedAgent['promise']
    if (!shared) throw new Error('Agente Neural Kart ainda não foi inicializado')
    return shared.exportCheckpoint()
  }

  static async importSharedCheckpoint(buffer: ArrayBuffer) {
    const shared = await SharedAgent['promise']
    if (!shared) throw new Error('Agente Neural Kart ainda não foi inicializado')
    shared.importCheckpoint(buffer)
  }

  static async resetSharedFromScratch() {
    const shared = await SharedAgent['promise']
    if (!shared) throw new Error('Agente Neural Kart ainda não foi inicializado')
    shared.resetFromScratch()
  }

  private async init() {
    this.shared = await SharedAgent.get(this.inputSize, this.outputSize, 512)
    this.shared.activeEnvs += 1
    this.sharedVersion = this.shared.version
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
    if (this.disposed || !this.shared) return null
    const agent = this.shared.agent

    if (this.sharedVersion !== this.shared.version) {
      this.pendingStep = null
      this.sharedVersion = this.shared.version
      this.reward = 0
      this.lastReward = 0
      this.totalReward = 0
      this.outputs.fill(0)
    }

    this.inputs = inputs.slice(0, this.inputSize)
    this.done = done
    const totalReward = reward

    if (this.pendingStep) {
      agent.storeTransition(
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

      this.shared.maybeTrain(this.inputs, done)
    }

    if (done) {
      this.pendingStep = null
      this.outputs = Array.from({ length: this.outputSize }, () => 0)
      return null
    }

    const { actions, logProbs, values } = agent.collectStep(this.inputs, 1)
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
    if (this.shared) this.shared.activeEnvs -= 1
    this.pendingStep = null
    this.disposed = true
  }
}
