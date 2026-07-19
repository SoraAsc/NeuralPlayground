import { createNNW, type NeuralNetwork, type PPOAgent } from 'nnw'

const CHECKPOINT_URL = '/models/asteroids.nnw'
const NUM_ENVS = 12
const OBSERVED_THREATS = 3
const THREAT_FEATURES = 7
const STATE_SIZE = 6 + OBSERVED_THREATS * THREAT_FEATURES
const ACTION_AXES = [3, 2, 2]
const POLICY_OUTPUTS = ACTION_AXES.reduce((sum, size) => sum + size, 0)
const ROLLOUT_STEPS = 128
const DT = 0.025
const WIDTH = 800
const HEIGHT = 500
const SHIP_RADIUS = 12
const TURN_SPEED = 5.2
const THRUST = 210
const DRAG = 0.994
const MAX_SPEED = 270
const BULLET_SPEED = 410
const BULLET_LIFE = 1.15
const SHOT_COOLDOWN = 0.22
const THREAT_HORIZON = 3

export type Asteroid = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  angle: number
  spin: number
  shape: number[]
}

export type AsteroidBullet = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

type AsteroidsEnvironment = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  cooldown: number
  asteroids: Asteroid[]
  bullets: AsteroidBullet[]
  episodeReward: number
  score: number
  survival: number
  wave: number
  thrusting: boolean
  firing: boolean
  rotationAction: number
  propulsionAction: number
  shootingAction: number
}

export type AsteroidsSnapshot = AsteroidsEnvironment & {
  index: number
  opacity: number
}

export type AsteroidsThreatSnapshot = {
  dx: number
  dy: number
  closestDx: number
  closestDy: number
  radius: number
  timeToClosest: number
  closestClearance: number
  risk: number
}

const wrap = (value: number, maximum: number) => ((value % maximum) + maximum) % maximum
const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from))
const torusDelta = (from: number, to: number, size: number) => {
  let delta = to - from
  if (delta > size / 2) delta -= size
  if (delta < -size / 2) delta += size
  return delta
}
const distanceSquared = (ax: number, ay: number, bx: number, by: number) => {
  const dx = torusDelta(ax, bx, WIDTH)
  const dy = torusDelta(ay, by, HEIGHT)
  return dx * dx + dy * dy
}

const SHIP_COLLIDER: Array<[number, number]> = [
  [1.55 * SHIP_RADIUS, 0],
  [0.2 * SHIP_RADIUS, 0.48 * SHIP_RADIUS],
  [-0.95 * SHIP_RADIUS, 1.12 * SHIP_RADIUS],
  [-0.7 * SHIP_RADIUS, 0.35 * SHIP_RADIUS],
  [-0.7 * SHIP_RADIUS, -0.35 * SHIP_RADIUS],
  [-0.95 * SHIP_RADIUS, -1.12 * SHIP_RADIUS],
  [0.2 * SHIP_RADIUS, -0.48 * SHIP_RADIUS],
]

const pointInPolygon = (x: number, y: number, polygon: Array<[number, number]>) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const pointSegmentDistanceSquared = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const closestX = ax + dx * t
  const closestY = ay + dy * t
  return (px - closestX) ** 2 + (py - closestY) ** 2
}

const shipHitsAsteroid = (env: AsteroidsEnvironment, asteroid: Asteroid) => {
  const dx = torusDelta(env.x, asteroid.x, WIDTH)
  const dy = torusDelta(env.y, asteroid.y, HEIGHT)
  const cos = Math.cos(env.angle)
  const sin = Math.sin(env.angle)
  const asteroidForward = dx * cos + dy * sin
  const asteroidSide = -dx * sin + dy * cos
  if (pointInPolygon(asteroidForward, asteroidSide, SHIP_COLLIDER)) return true

  const collisionRadiusSquared = (asteroid.radius * 0.82) ** 2
  return SHIP_COLLIDER.some((start, index) => {
    const end = SHIP_COLLIDER[(index + 1) % SHIP_COLLIDER.length]!
    return (
      pointSegmentDistanceSquared(
        asteroidForward,
        asteroidSide,
        start[0],
        start[1],
        end[0],
        end[1],
      ) <= collisionRadiusSquared
    )
  })
}

type ThreatMetrics = {
  asteroid: Asteroid
  dx: number
  dy: number
  relativeVx: number
  relativeVy: number
  closestDx: number
  closestDy: number
  timeToClosest: number
  closestClearance: number
  risk: number
}

const threatMetrics = (env: AsteroidsEnvironment, asteroid: Asteroid): ThreatMetrics => {
  const dx = torusDelta(env.x, asteroid.x, WIDTH)
  const dy = torusDelta(env.y, asteroid.y, HEIGHT)
  const relativeVx = asteroid.vx - env.vx
  const relativeVy = asteroid.vy - env.vy
  const relativeSpeedSquared = relativeVx ** 2 + relativeVy ** 2
  const rawTimeToClosest =
    relativeSpeedSquared > 0.001
      ? -(dx * relativeVx + dy * relativeVy) / relativeSpeedSquared
      : Number.POSITIVE_INFINITY
  const approaching = rawTimeToClosest > 0
  const timeToClosest = approaching
    ? Math.min(rawTimeToClosest, THREAT_HORIZON)
    : THREAT_HORIZON
  const closestDx = dx + relativeVx * timeToClosest
  const closestDy = dy + relativeVy * timeToClosest
  const collisionRadius = SHIP_RADIUS * 1.55 + asteroid.radius * 0.82
  const closestClearance = Math.hypot(closestDx, closestDy) - collisionRadius
  const predictedProximity = Math.max(0, Math.min(1, 1 - closestClearance / 140))
  const urgency =
    approaching && rawTimeToClosest <= THREAT_HORIZON
      ? 1 - rawTimeToClosest / THREAT_HORIZON
      : 0
  const risk = predictedProximity * (0.2 + urgency * 0.8)
  return {
    asteroid,
    dx,
    dy,
    relativeVx,
    relativeVy,
    closestDx,
    closestDy,
    timeToClosest,
    closestClearance,
    risk,
  }
}

const rankedThreats = (env: AsteroidsEnvironment) =>
  env.asteroids
    .map((asteroid) => threatMetrics(env, asteroid))
    .sort(
      (a, b) =>
        b.risk - a.risk ||
        a.dx ** 2 + a.dy ** 2 - (b.dx ** 2 + b.dy ** 2),
    )

const totalDanger = (env: AsteroidsEnvironment) =>
  rankedThreats(env)
    .slice(0, OBSERVED_THREATS)
    .reduce((sum, threat) => sum + threat.risk, 0)

export class AsteroidsPPOEnvironment {
  private nnw!: Awaited<ReturnType<typeof createNNW>>
  private actor!: NeuralNetwork
  private critic!: NeuralNetwork
  private agent!: PPOAgent
  private envs: AsteroidsEnvironment[] = []
  private rolloutSteps = 0

  episodes = 0
  bestReward = Number.NEGATIVE_INFINITY
  bestScore = 0
  bestWave = 1
  rewardHistory: number[] = []
  scoreHistory: number[] = []
  autoLoadedCheckpoint = false

  async init() {
    this.nnw = await createNNW()
    this.actor = this.nnw
      .createModel(STATE_SIZE)
      .addDense(128, 'tanh')
      .addDense(128, 'tanh')
      .addDense(POLICY_OUTPUTS, 'linear')
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
    const rewards = Array.from({ length: NUM_ENVS }, () => 0)
    const dones = Array.from({ length: NUM_ENVS }, () => 0)

    this.envs.forEach((env, index) => {
      const actionOffset = index * ACTION_AXES.length
      const rotation = Math.round(actions[actionOffset] ?? 0)
      const propulsion = Math.round(actions[actionOffset + 1] ?? 0)
      const shooting = Math.round(actions[actionOffset + 2] ?? 0)
      const { reward, done } = this.stepEnvironment(env, rotation, propulsion, shooting)
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

  snapshots(): AsteroidsSnapshot[] {
    const ranked = [...this.envs].sort(
      (a, b) => b.episodeReward - a.episodeReward || b.survival - a.survival,
    )
    const ranks = new Map(ranked.map((env, index) => [env, index]))
    return this.envs.map((env, index) => ({
      ...env,
      index,
      opacity: 0.18 + (1 - (ranks.get(env) ?? 0) / Math.max(1, NUM_ENVS - 1)) * 0.82,
    }))
  }

  leader() {
    return this.snapshots().reduce((best, ship) =>
      ship.episodeReward > best.episodeReward ||
      (ship.episodeReward === best.episodeReward && ship.survival > best.survival)
        ? ship
        : best,
    )
  }

  debugThreats(snapshot: AsteroidsSnapshot): AsteroidsThreatSnapshot[] {
    return rankedThreats(snapshot)
      .slice(0, OBSERVED_THREATS)
      .map((threat) => ({
        dx: threat.dx,
        dy: threat.dy,
        closestDx: threat.closestDx,
        closestDy: threat.closestDy,
        radius: threat.asteroid.radius,
        timeToClosest: threat.timeToClosest,
        closestClearance: threat.closestClearance,
        risk: threat.risk,
      }))
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
      actionSpace: 'multiDiscrete',
      multiDiscreteSizes: ACTION_AXES,
      optimizer: 'adamw',
      numEnvs: NUM_ENVS,
      rolloutSteps: ROLLOUT_STEPS,
      minibatchSize: 256,
      learningRate: 3e-4,
      gamma: 0.995,
      gaeLambda: 0.95,
      clipRange: 0.2,
      valueLossCoef: 0.5,
      entropyCoef: 0.015,
      maxGradNorm: 0.5,
      epochs: 4,
    })
  }

  private createEnvironment(index: number): AsteroidsEnvironment {
    const env: AsteroidsEnvironment = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2 + (index / NUM_ENVS) * 0.08,
      cooldown: 0,
      asteroids: [],
      bullets: [],
      episodeReward: 0,
      score: 0,
      survival: 0,
      wave: 1,
      thrusting: false,
      firing: false,
      rotationAction: 0,
      propulsionAction: 0,
      shootingAction: 0,
    }
    this.spawnWave(env)
    return env
  }

  private resetEnvironment(env: AsteroidsEnvironment, index: number) {
    Object.assign(env, this.createEnvironment(index))
  }

  private spawnWave(env: AsteroidsEnvironment) {
    const count = Math.min(7, 2 + env.wave)
    for (let i = 0; i < count; i++) {
      let x = 0
      let y = 0
      do {
        x = Math.random() * WIDTH
        y = Math.random() * HEIGHT
      } while (distanceSquared(env.x, env.y, x, y) < 150 * 150)
      env.asteroids.push(this.createAsteroid(x, y, 34 + Math.random() * 9, env.wave))
    }
  }

  private createAsteroid(x: number, y: number, radius: number, wave: number): Asteroid {
    const direction = Math.random() * Math.PI * 2
    const speed = 30 + Math.random() * 38 + wave * 3
    return {
      x,
      y,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      radius,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.2,
      shape: Array.from({ length: 9 }, () => 0.72 + Math.random() * 0.28),
    }
  }

  private getState(env: AsteroidsEnvironment) {
    const threats = rankedThreats(env).slice(0, OBSERVED_THREATS)
    const asteroidState = threats.flatMap((threat) => {
      return [
        threat.dx / (WIDTH / 2),
        threat.dy / (HEIGHT / 2),
        threat.relativeVx / 400,
        threat.relativeVy / 400,
        threat.asteroid.radius / 45,
        threat.timeToClosest / THREAT_HORIZON,
        Math.max(-1, Math.min(1, threat.closestClearance / 140)),
      ]
    })
    for (let i = threats.length; i < OBSERVED_THREATS; i++) {
      asteroidState.push(0, 0, 0, 0, 0, 1, 1)
    }
    const primaryThreat = threats[0]
    const targetAngle = primaryThreat
      ? Math.atan2(primaryThreat.dy, primaryThreat.dx)
      : env.angle
    return [
      env.vx / MAX_SPEED,
      env.vy / MAX_SPEED,
      Math.sin(env.angle),
      Math.cos(env.angle),
      angleDelta(env.angle, targetAngle) / Math.PI,
      Math.max(0, env.cooldown) / SHOT_COOLDOWN,
      ...asteroidState,
    ]
  }

  private stepEnvironment(
    env: AsteroidsEnvironment,
    rotation: number,
    propulsion: number,
    shooting: number,
  ) {
    const dangerBefore = totalDanger(env)
    env.thrusting = false
    env.firing = false
    env.rotationAction = rotation
    env.propulsionAction = propulsion
    env.shootingAction = shooting
    if (rotation === 1) env.angle += TURN_SPEED * DT
    if (rotation === 2) env.angle -= TURN_SPEED * DT
    env.angle = Math.atan2(Math.sin(env.angle), Math.cos(env.angle))
    if (propulsion === 1) {
      env.vx += Math.cos(env.angle) * THRUST * DT
      env.vy += Math.sin(env.angle) * THRUST * DT
      env.thrusting = true
    }
    if (shooting === 1 && env.cooldown <= 0) this.shoot(env)

    const speed = Math.hypot(env.vx, env.vy)
    if (speed > MAX_SPEED) {
      env.vx = (env.vx / speed) * MAX_SPEED
      env.vy = (env.vy / speed) * MAX_SPEED
    }
    env.vx *= DRAG
    env.vy *= DRAG
    env.x = wrap(env.x + env.vx * DT, WIDTH)
    env.y = wrap(env.y + env.vy * DT, HEIGHT)
    env.cooldown -= DT
    env.survival += DT

    for (const asteroid of env.asteroids) {
      asteroid.x = wrap(asteroid.x + asteroid.vx * DT, WIDTH)
      asteroid.y = wrap(asteroid.y + asteroid.vy * DT, HEIGHT)
      asteroid.angle += asteroid.spin * DT
    }
    for (const bullet of env.bullets) {
      bullet.x = wrap(bullet.x + bullet.vx * DT, WIDTH)
      bullet.y = wrap(bullet.y + bullet.vy * DT, HEIGHT)
      bullet.life -= DT
    }
    env.bullets = env.bullets.filter((bullet) => bullet.life > 0)

    let reward = 0.004
    const primaryThreat = rankedThreats(env)[0]
    if (primaryThreat) {
      const targetAngle = Math.atan2(primaryThreat.dy, primaryThreat.dx)
      const alignment = Math.cos(angleDelta(env.angle, targetAngle))
      reward += Math.max(0, alignment) * 0.002
    }
    for (let bulletIndex = env.bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
      const bullet = env.bullets[bulletIndex]!
      const asteroidIndex = env.asteroids.findIndex(
        (asteroid) =>
          distanceSquared(bullet.x, bullet.y, asteroid.x, asteroid.y) < asteroid.radius ** 2,
      )
      if (asteroidIndex < 0) continue
      const asteroid = env.asteroids[asteroidIndex]!
      env.bullets.splice(bulletIndex, 1)
      env.asteroids.splice(asteroidIndex, 1)
      env.score++
      reward += asteroid.radius > 22 ? 1 : 1.5
      if (asteroid.radius > 22) {
        for (let i = 0; i < 2; i++) {
          const fragment = this.createAsteroid(
            asteroid.x,
            asteroid.y,
            asteroid.radius * 0.57,
            env.wave,
          )
          fragment.vx += asteroid.vx * 0.35
          fragment.vy += asteroid.vy * 0.35
          env.asteroids.push(fragment)
        }
      }
    }

    if (env.asteroids.length === 0) {
      env.wave++
      reward += 4
      this.spawnWave(env)
    }

    reward += (dangerBefore - totalDanger(env)) * 0.08

    const done = env.asteroids.some((asteroid) => shipHitsAsteroid(env, asteroid))
    if (done) reward -= 2
    return { reward, done }
  }

  private shoot(env: AsteroidsEnvironment) {
    const dx = Math.cos(env.angle)
    const dy = Math.sin(env.angle)
    env.bullets.push({
      x: wrap(env.x + dx * 17, WIDTH),
      y: wrap(env.y + dy * 17, HEIGHT),
      vx: env.vx + dx * BULLET_SPEED,
      vy: env.vy + dy * BULLET_SPEED,
      life: BULLET_LIFE,
    })
    env.cooldown = SHOT_COOLDOWN
    env.firing = true
  }

  private completeEpisode(env: AsteroidsEnvironment) {
    this.episodes++
    this.bestReward = Math.max(this.bestReward, env.episodeReward)
    this.bestScore = Math.max(this.bestScore, env.score)
    this.bestWave = Math.max(this.bestWave, env.wave)
    this.rewardHistory.push(env.episodeReward)
    if (this.rewardHistory.length > 200) this.rewardHistory.shift()
    this.scoreHistory.push(env.score)
    if (this.scoreHistory.length > 200) this.scoreHistory.shift()
  }

  private resetSession() {
    this.rolloutSteps = 0
    this.episodes = 0
    this.bestReward = Number.NEGATIVE_INFINITY
    this.bestScore = 0
    this.bestWave = 1
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
      console.warn('Asteroids: não foi possível carregar o checkpoint publicado', error)
    }
  }

  dispose() {
    this.agent?.dispose()
    this.actor?.dispose()
    this.critic?.dispose()
  }
}

export const ASTEROIDS_WORLD = {
  width: WIDTH,
  height: HEIGHT,
  numEnvs: NUM_ENVS,
  shipRadius: SHIP_RADIUS,
}
