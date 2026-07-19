import { createNNW, type PPOAgent, type NeuralNetwork } from 'nnw'

type PendingStep = {
  state: number[]
  action: number[]
  logProbs: number[]
  values: number[]
}

export type NeuralKartBatchStep = {
  env: NeuralKartEnvironment
  inputs: number[]
  reward: number
  done: boolean
}

const CHECKPOINT_URL = `${import.meta.env.BASE_URL}models/neural-kart.nnw`

export type PPOSettings = {
  learningRate: number
  gamma: number
  entropyCoef: number
}

const DEFAULT_PPO_SETTINGS: PPOSettings = {
  learningRate: 5e-5,
  gamma: 0.99,
  entropyCoef: 0.005,
}

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
  interactionVersion = 0
  publishedCheckpointLoaded = false
  private stepsSinceTrain = 0
  settings: PPOSettings = { ...DEFAULT_PPO_SETTINGS }

  private constructor(
    private inputSize: number,
    private outputSize: number,
    private rolloutSteps: number,
    private numEnvs: number,
  ) {}

  static async get(inputSize: number, outputSize: number, numEnvs: number, rolloutSteps = 512) {
    if (!this.promise) {
      this.promise = (async () => {
        const shared = new SharedAgent(inputSize, outputSize, rolloutSteps, numEnvs)
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
      numEnvs: this.numEnvs,
      rolloutSteps: this.rolloutSteps,
      minibatchSize: 128,
      learningRate: this.settings.learningRate,
      gamma: this.settings.gamma,
      gaeLambda: 0.95,
      clipRange: 0.2,
      valueLossCoef: 0.5,
      entropyCoef: this.settings.entropyCoef,
      maxGradNorm: 0.5,
      epochs: 2,
    })
  }

  private async tryLoadPublishedCheckpoint() {
    try {
      const response = await fetch(CHECKPOINT_URL, { cache: 'no-store' })
      if (!response.ok) return
      this.nnw.loadCheckpoint(await response.arrayBuffer(), this.models())
      this.publishedCheckpointLoaded = true
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

  updateSettings(settings: Partial<PPOSettings>) {
    this.settings = { ...this.settings, ...settings }
    this.restartAgent()
  }

  setTraining(training: boolean) {
    this.agent.training = training
    this.stepsSinceTrain = 0
    this.interactionVersion += 1
  }

  storeBatch(steps: NeuralKartBatchStep[]) {
    const pending = steps.map(({ env }) => env.getPendingStep())
    if (pending.every((step) => step !== null)) {
      this.agent.storeTransition(
        pending.flatMap((step) => step?.state ?? []),
        this.numEnvs,
        pending.flatMap((step) => step?.action ?? []),
        pending.flatMap((step) => step?.logProbs ?? []),
        steps.map(({ reward }) => reward),
        steps.map(({ done }) => (done ? 1 : 0)),
        pending.flatMap((step) => step?.values ?? []),
      )
      this.maybeTrain(
        steps.flatMap(({ inputs }) => inputs),
        steps.map(({ done }) => done),
      )
    }

    const states = steps.flatMap(({ inputs }) => inputs)
    const { actions, logProbs, values } = this.agent.collectStep(states, this.numEnvs)
    steps.forEach(({ env }, index) => {
      const actionOffset = index * this.outputSize
      env.setPendingStep({
        state: states.slice(index * this.inputSize, (index + 1) * this.inputSize),
        action: actions.slice(actionOffset, actionOffset + this.outputSize),
        logProbs: [logProbs[index] ?? 0],
        values: [values[index] ?? 0],
      })
    })
  }

  private maybeTrain(bootstrapStates: number[], dones: boolean[]) {
    this.stepsSinceTrain += 1
    if (this.stepsSinceTrain < this.rolloutSteps) return
    const bootstrap = this.agent.collectStep(bootstrapStates, this.numEnvs).values
    this.agent.train(
      bootstrap.map((value, index) => (dones[index] ? 0 : value)),
      dones.map((done) => (done ? 1 : 0)),
    )
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
  public episodes = 0
  public lastEpisodeReward = 0
  public bestReward = Number.NEGATIVE_INFINITY
  public bestLaps = 0
  public rewardHistory: number[] = []
  public envIndex = 0

  private shared: SharedAgent | null = null
  private pendingStep: PendingStep | null = null
  private disposed = false
  private sharedVersion = 0
  private sharedInteractionVersion = 0
  private numEnvs: number

  private constructor(inputSize: number, outputSize: number, numEnvs: number) {
    this.inputSize = inputSize
    this.outputSize = outputSize
    this.numEnvs = numEnvs
    this.reset()
  }

  static async create(inputSize: number, outputSize: number, numEnvs: number) {
    const env = new NeuralKartEnvironment(inputSize, outputSize, numEnvs)
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

  static async wasPublishedCheckpointLoaded() {
    const shared = await SharedAgent['promise']
    return shared?.publishedCheckpointLoaded ?? false
  }

  static async updateSharedSettings(settings: Partial<PPOSettings>) {
    const shared = await SharedAgent['promise']
    if (!shared) throw new Error('Agente Neural Kart ainda não foi inicializado')
    shared.updateSettings(settings)
  }

  static async setSharedTraining(training: boolean) {
    const shared = await SharedAgent['promise']
    if (!shared) throw new Error('Agente Neural Kart ainda não foi inicializado')
    shared.setTraining(training)
  }

  static async getSharedTraining() {
    const shared = await SharedAgent['promise']
    return shared?.agent.training ?? true
  }

  static stepBatch(steps: NeuralKartBatchStep[]) {
    if (steps.length === 0) return
    const shared = steps[0]?.env.shared
    if (!shared) return
    if (steps.length !== shared.activeEnvs) {
      throw new Error(`PPO esperava ${shared.activeEnvs} ambientes, recebeu ${steps.length}`)
    }

    for (const step of steps) {
      step.env.prepareBatchStep(step.inputs, step.reward, step.done)
    }
    shared.storeBatch(steps)
  }

  private async init() {
    this.shared = await SharedAgent.get(this.inputSize, this.outputSize, this.numEnvs, 512)
    this.envIndex = this.shared.activeEnvs
    this.shared.activeEnvs += 1
    this.sharedVersion = this.shared.version
    this.sharedInteractionVersion = this.shared.interactionVersion
  }

  reset(): number[] {
    this.pendingStep = null
    this.inputs = Array.from({ length: this.inputSize }, () => 0)
    this.outputs = Array.from({ length: this.outputSize }, () => 0)
    this.reward = 0
    this.lastReward = 0
    this.totalReward = 0
    this.done = false
    return this.outputs
  }

  private prepareBatchStep(inputs: number[], reward: number, done: boolean) {
    if (this.disposed || !this.shared) return
    if (this.sharedVersion !== this.shared.version) {
      this.pendingStep = null
      this.sharedVersion = this.shared.version
      this.reward = 0
      this.lastReward = 0
      this.totalReward = 0
      this.outputs.fill(0)
      this.resetStatistics()
    }
    if (this.sharedInteractionVersion !== this.shared.interactionVersion) {
      this.pendingStep = null
      this.sharedInteractionVersion = this.shared.interactionVersion
    }

    this.inputs = inputs.slice(0, this.inputSize)
    this.done = done
    if (this.pendingStep) {
      this.lastReward = reward
      this.totalReward += reward
    }
  }

  getPendingStep() {
    return this.pendingStep
  }

  setPendingStep(step: PendingStep) {
    this.pendingStep = step
    this.outputs = step.action.slice()
    this.reward = 0
  }

  resetEpisode() {
    this.reward = 0
    this.lastReward = 0
    this.totalReward = 0
    this.done = false
  }

  private resetStatistics() {
    this.episodes = 0
    this.lastEpisodeReward = 0
    this.bestReward = Number.NEGATIVE_INFINITY
    this.bestLaps = 0
    this.rewardHistory = []
  }

  isDone(): boolean {
    return this.done
  }

  completeEpisode(laps: number) {
    this.episodes += 1
    this.lastEpisodeReward = this.totalReward
    this.bestReward = Math.max(this.bestReward, this.totalReward)
    this.bestLaps = Math.max(this.bestLaps, laps)
    this.rewardHistory.push(this.totalReward)
    if (this.rewardHistory.length > 200) this.rewardHistory.shift()
  }

  dispose() {
    if (this.disposed) return
    if (this.shared) this.shared.activeEnvs -= 1
    this.pendingStep = null
    this.disposed = true
  }
}
