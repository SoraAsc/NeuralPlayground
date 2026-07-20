import { createNNW, type NeuralNetwork, type NeuralNetworkTrainer } from 'nnw'

export const SHAPES = ['Círculo', 'Quadrado', 'Triângulo'] as const
export type ShapeName = (typeof SHAPES)[number]

const SIZE = 16
const distanceToSegment = (
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared))
    : 0
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}

const renderShape = (shape: number, variant: number) => {
  const pixels = Array<number>(SIZE * SIZE).fill(0)
  const cx = 7.5 + (((variant * 17) % 7) - 3) * 0.22
  const cy = 7.5 + (((variant * 29) % 7) - 3) * 0.22
  const radius = 4.4 + ((variant * 11) % 8) * 0.14
  const thickness = 0.72 + (variant % 4) * 0.12
  const rotation = (((variant * 13) % 9) - 4) * 0.035

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const localX = (x - cx) * cos - (y - cy) * sin
      const localY = (x - cx) * sin + (y - cy) * cos
      let distance = Infinity
      if (shape === 0) distance = Math.abs(Math.hypot(localX, localY) - radius)
      if (shape === 1) distance = Math.abs(Math.max(Math.abs(localX), Math.abs(localY)) - radius)
      if (shape === 2) {
        const vertices: Array<[number, number]> = [
          [0, -radius],
          [-radius * 0.9, radius * 0.75],
          [radius * 0.9, radius * 0.75],
        ]
        distance = Math.min(
          distanceToSegment(localX, localY, ...vertices[0]!, ...vertices[1]!),
          distanceToSegment(localX, localY, ...vertices[1]!, ...vertices[2]!),
          distanceToSegment(localX, localY, ...vertices[2]!, ...vertices[0]!),
        )
      }
      const value = Math.max(0, Math.min(1, thickness + 0.45 - distance))
      pixels[y * SIZE + x] = value
    }
  }
  return pixels
}

const createDataset = () => {
  const inputs: number[] = []
  const targets: number[] = []
  for (let shape = 0; shape < SHAPES.length; shape++) {
    for (let variant = 0; variant < 160; variant++) {
      inputs.push(...renderShape(shape, variant))
      targets.push(...SHAPES.map((_, index) => Number(index === shape)))
    }
  }
  return { inputs, targets, samples: inputs.length / (SIZE * SIZE) }
}

export class ShapeClassifierLab {
  private nnw!: Awaited<ReturnType<typeof createNNW>>
  private model: NeuralNetwork | null = null
  private trainer: NeuralNetworkTrainer | null = null
  private readonly dataset = createDataset()

  async init() {
    this.nnw = await createNNW()
    this.reset()
  }

  reset() {
    this.trainer?.dispose()
    this.model?.dispose()
    this.model = this.nnw
      .createModel(SIZE * SIZE)
      .addDense(32, 'relu')
      .addDense(16, 'relu')
      .addDense(SHAPES.length, 'sigmoid')
    this.trainer = this.nnw.createTrainer(this.model, {
      optimizer: 'adamw',
      batchSize: 32,
      shuffle: true,
      learningRate: 0.003,
    })
  }

  train(epochs: number) {
    return Array.from({ length: epochs }, () =>
      this.trainer!.train(this.dataset.inputs, this.dataset.targets),
    )
  }

  predict(pixels: ArrayLike<number>) {
    const scores = this.model ? Array.from(this.model.predict(Array.from(pixels))) : [0, 0, 0]
    const index = scores.reduce(
      (best, value, current) => (value > (scores[best] ?? -Infinity) ? current : best),
      0,
    )
    return { shape: SHAPES[index]!, confidence: scores[index] ?? 0, scores }
  }

  accuracy() {
    if (!this.model) return 0
    const outputs = this.model.predict(this.dataset.inputs)
    let correct = 0
    for (let sample = 0; sample < this.dataset.samples; sample++) {
      let best = 0
      for (let index = 1; index < SHAPES.length; index++)
        if (outputs[sample * SHAPES.length + index]! > outputs[sample * SHAPES.length + best]!)
          best = index
      if (this.dataset.targets[sample * SHAPES.length + best] === 1) correct++
    }
    return correct / this.dataset.samples
  }

  dispose() {
    this.trainer?.dispose()
    this.model?.dispose()
  }
}

export const SHAPE_INPUT_SIZE = SIZE
