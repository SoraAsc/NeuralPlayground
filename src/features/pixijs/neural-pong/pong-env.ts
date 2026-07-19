import { createNNW, type QLearningAgent } from 'nnw'

const WIDTH = 800
const HEIGHT = 500
const PADDLE_WIDTH = 14
const PADDLE_HEIGHT = 92
const PADDLE_MARGIN = 28
const BALL_SIZE = 12
const PADDLE_SPEED = 360
const BALL_SPEED = 300
const CHECKPOINT_URL = '/models/neural-pong.nqt'

const X_BINS = 6
const Y_BINS = 11
const VY_BINS = 3
const TOWARD_BINS = 2
const STATE_COUNT = X_BINS * Y_BINS * VY_BINS * TOWARD_BINS
const ACTION_COUNT = 3 // stay, up, down

type Side = 'left' | 'right'

export type PongAgentDebug = {
  state: number
  action: number
  qValues: number[]
  xBin: number
  yBin: number
  verticalDirectionBin: number
  toward: boolean
}

export type PongDiagnostics = {
  left: PongAgentDebug
  right: PongAgentDebug
}

export type PongSnapshot = {
  width: number
  height: number
  paddleWidth: number
  paddleHeight: number
  ballSize: number
  leftY: number
  rightY: number
  ballX: number
  ballY: number
  leftScore: number
  rightScore: number
  episodes: number
  rallies: number
  bestRally: number
  epsilon: number
  training: boolean
  rallyHistory: number[]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function bin(value: number, count: number) {
  return clamp(Math.floor(value * count), 0, count - 1)
}

export class NeuralPongEnvironment {
  private agent!: QLearningAgent
  private leftY = (HEIGHT - PADDLE_HEIGHT) / 2
  private rightY = (HEIGHT - PADDLE_HEIGHT) / 2
  private ballX = WIDTH / 2
  private ballY = HEIGHT / 2
  private ballVx = BALL_SPEED
  private ballVy = 0
  private leftScore = 0
  private rightScore = 0
  private episodes = 0
  private rallies = 0
  private bestRally = 0
  private rallyHistory: number[] = []
  private lastLeftState = 0
  private lastRightState = 0
  private lastLeftAction = 0
  private lastRightAction = 0
  autoLoadedCheckpoint = false

  static async create() {
    const environment = new NeuralPongEnvironment()
    const nnw = await createNNW()
    environment.agent = nnw.createQLearningAgent({
      states: STATE_COUNT,
      actions: ACTION_COUNT,
      learningRate: 0.18,
      discountFactor: 0.97,
      epsilonStart: 1,
      epsilonMin: 0.025,
      epsilonDecay: 0.000015,
      epsilonDecayInterval: 'step',
    })
    environment.resetBall()
    await environment.tryLoadPublishedCheckpoint()
    return environment
  }

  step(dt = 1 / 120) {
    const leftState = this.stateFor('left')
    const rightState = this.stateFor('right')
    const leftAction = this.agent.chooseAction(leftState)
    const rightAction = this.agent.chooseAction(rightState)
    this.lastLeftState = leftState
    this.lastRightState = rightState
    this.lastLeftAction = leftAction
    this.lastRightAction = rightAction
    const leftDistanceBefore = this.distanceFromBall('left')
    const rightDistanceBefore = this.distanceFromBall('right')

    this.leftY = this.movePaddle(this.leftY, leftAction, dt)
    this.rightY = this.movePaddle(this.rightY, rightAction, dt)
    this.ballX += this.ballVx * dt
    this.ballY += this.ballVy * dt

    if (this.ballY <= 0) {
      this.ballY = 0
      this.ballVy = Math.abs(this.ballVy)
    } else if (this.ballY + BALL_SIZE >= HEIGHT) {
      this.ballY = HEIGHT - BALL_SIZE
      this.ballVy = -Math.abs(this.ballVy)
    }

    let leftReward = (leftDistanceBefore - this.distanceFromBall('left')) / HEIGHT * 0.08 - 0.0005
    let rightReward = (rightDistanceBefore - this.distanceFromBall('right')) / HEIGHT * 0.08 - 0.0005

    if (this.ballVx < 0 && this.ballX <= PADDLE_MARGIN + PADDLE_WIDTH
        && this.ballX + BALL_SIZE >= PADDLE_MARGIN && this.overlapsPaddle(this.leftY)) {
      this.ballX = PADDLE_MARGIN + PADDLE_WIDTH
      this.bounceFromPaddle(this.leftY, 1)
      leftReward += 0.35
      this.registerRally()
    } else if (this.ballVx > 0 && this.ballX + BALL_SIZE >= WIDTH - PADDLE_MARGIN - PADDLE_WIDTH
        && this.ballX <= WIDTH - PADDLE_MARGIN && this.overlapsPaddle(this.rightY)) {
      this.ballX = WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE
      this.bounceFromPaddle(this.rightY, -1)
      rightReward += 0.35
      this.registerRally()
    }

    let done = false
    if (this.ballX + BALL_SIZE < 0) {
      this.rightScore += 1
      leftReward -= 1
      rightReward += 0.5
      done = true
    } else if (this.ballX > WIDTH) {
      this.leftScore += 1
      rightReward -= 1
      leftReward += 0.5
      done = true
    }

    const nextLeftState = done ? leftState : this.stateFor('left')
    const nextRightState = done ? rightState : this.stateFor('right')
    this.agent.update(leftState, leftAction, leftReward, nextLeftState, done)
    this.agent.update(rightState, rightAction, rightReward, nextRightState, done)

    if (done) {
      this.rallyHistory.push(this.rallies)
      if (this.rallyHistory.length > 200) this.rallyHistory.shift()
      this.episodes += 1
      this.rallies = 0
      this.resetBall()
    }
  }

  snapshot(): PongSnapshot {
    return {
      width: WIDTH,
      height: HEIGHT,
      paddleWidth: PADDLE_WIDTH,
      paddleHeight: PADDLE_HEIGHT,
      ballSize: BALL_SIZE,
      leftY: this.leftY,
      rightY: this.rightY,
      ballX: this.ballX,
      ballY: this.ballY,
      leftScore: this.leftScore,
      rightScore: this.rightScore,
      episodes: this.episodes,
      rallies: this.rallies,
      bestRally: this.bestRally,
      epsilon: this.agent.epsilon,
      training: this.agent.training,
      rallyHistory: this.rallyHistory,
    }
  }

  diagnostics(): PongDiagnostics {
    const table = this.agent.exportQTable()
    return {
      left: this.agentDebug(this.lastLeftState, this.lastLeftAction, table),
      right: this.agentDebug(this.lastRightState, this.lastRightAction, table),
    }
  }

  setTraining(training: boolean) {
    this.agent.training = training
  }

  saveCheckpoint() {
    return this.agent.saveCheckpoint()
  }

  loadCheckpoint(buffer: ArrayBuffer) {
    this.agent.loadCheckpoint(buffer)
    this.resetMatch()
  }

  clear() {
    this.agent.reset()
    this.resetMatch()
  }

  dispose() {
    this.agent.dispose()
  }

  private stateFor(side: Side) {
    const paddleY = side === 'left' ? this.leftY : this.rightY
    const localX = side === 'left' ? this.ballX / WIDTH : (WIDTH - this.ballX - BALL_SIZE) / WIDTH
    const relativeY = (this.ballY + BALL_SIZE / 2 - (paddleY + PADDLE_HEIGHT / 2)) / HEIGHT + 0.5
    const toward = side === 'left' ? this.ballVx < 0 : this.ballVx > 0
    const vy = this.ballVy < -20 ? 0 : this.ballVy > 20 ? 2 : 1
    const x = bin(clamp(localX, 0, 0.999999), X_BINS)
    const y = bin(clamp(relativeY, 0, 0.999999), Y_BINS)
    return (((x * Y_BINS + y) * VY_BINS + vy) * TOWARD_BINS + (toward ? 1 : 0))
  }

  private agentDebug(state: number, action: number, table: Float32Array): PongAgentDebug {
    let cursor = state
    const toward = cursor % TOWARD_BINS === 1
    cursor = Math.floor(cursor / TOWARD_BINS)
    const verticalDirectionBin = cursor % VY_BINS
    cursor = Math.floor(cursor / VY_BINS)
    const yBin = cursor % Y_BINS
    const xBin = Math.floor(cursor / Y_BINS)
    const offset = state * ACTION_COUNT
    return {
      state,
      action,
      qValues: Array.from(table.slice(offset, offset + ACTION_COUNT)),
      xBin,
      yBin,
      verticalDirectionBin,
      toward,
    }
  }

  private movePaddle(y: number, action: number, dt: number) {
    const direction = action === 1 ? -1 : action === 2 ? 1 : 0
    return clamp(y + direction * PADDLE_SPEED * dt, 0, HEIGHT - PADDLE_HEIGHT)
  }

  private distanceFromBall(side: Side) {
    const y = side === 'left' ? this.leftY : this.rightY
    return Math.abs(this.ballY + BALL_SIZE / 2 - (y + PADDLE_HEIGHT / 2))
  }

  private overlapsPaddle(paddleY: number) {
    return this.ballY + BALL_SIZE >= paddleY && this.ballY <= paddleY + PADDLE_HEIGHT
  }

  private bounceFromPaddle(paddleY: number, horizontalDirection: 1 | -1) {
    const offset = clamp(
      (this.ballY + BALL_SIZE / 2 - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2),
      -1,
      1,
    )
    const speed = Math.min(470, Math.hypot(this.ballVx, this.ballVy) * 1.025)
    const angle = offset * Math.PI * 0.32
    this.ballVx = Math.cos(angle) * speed * horizontalDirection
    this.ballVy = Math.sin(angle) * speed
  }

  private registerRally() {
    this.rallies += 1
    this.bestRally = Math.max(this.bestRally, this.rallies)
  }

  private resetBall() {
    this.ballX = WIDTH / 2 - BALL_SIZE / 2
    this.ballY = HEIGHT * (0.25 + Math.random() * 0.5)
    const direction = Math.random() < 0.5 ? -1 : 1
    this.ballVx = BALL_SPEED * direction
    this.ballVy = (Math.random() * 2 - 1) * BALL_SPEED * 0.55
  }

  private resetMatch() {
    this.leftY = this.rightY = (HEIGHT - PADDLE_HEIGHT) / 2
    this.leftScore = this.rightScore = this.episodes = this.rallies = this.bestRally = 0
    this.rallyHistory = []
    this.resetBall()
  }

  private async tryLoadPublishedCheckpoint() {
    try {
      const response = await fetch(CHECKPOINT_URL, { cache: 'no-store' })
      if (response.ok) {
        this.agent.loadCheckpoint(await response.arrayBuffer())
        this.autoLoadedCheckpoint = true
      }
    } catch (error) {
      console.warn('Neural Pong: não foi possível carregar a Q-table publicada', error)
    }
  }
}
