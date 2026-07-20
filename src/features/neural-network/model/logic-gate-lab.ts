import { createNNW, type NeuralNetwork, type NeuralNetworkTrainer } from 'nnw'

export type HiddenLayer = {
  id: number
  units: number
  activation: 'relu' | 'sigmoid' | 'tanh'
}

export type DecisionCell = {
  x: number
  y: number
  value: number
}

export type DatasetPoint = { x: number; y: number; target: 0 | 1 }
export type DatasetId = 'and' | 'xor'
export type DatasetDefinition = {
  id: DatasetId
  name: string
  shortName: string
  description: string
  points: DatasetPoint[]
}

const logicPoints = (targets: Array<0 | 1>): DatasetPoint[] =>
  [
    [0.08, 0.08],
    [0.08, 0.92],
    [0.92, 0.08],
    [0.92, 0.92],
  ].map(([x, y], index) => ({ x: x!, y: y!, target: targets[index]! }))

export const DATASETS: Record<DatasetId, DatasetDefinition> = {
  and: {
    id: 'and',
    name: 'Porta lógica AND',
    shortName: 'AND',
    description: 'Um problema linearmente separável: somente 1 AND 1 produz classe positiva.',
    points: logicPoints([0, 0, 0, 1]),
  },
  xor: {
    id: 'xor',
    name: 'Porta lógica XOR',
    shortName: 'XOR',
    description:
      'Classes alternadas exigem que as camadas ocultas construam uma fronteira não linear.',
    points: logicPoints([0, 1, 1, 0]),
  },
}

export class LogicGateLab {
  private nnw!: Awaited<ReturnType<typeof createNNW>>
  private model: NeuralNetwork | null = null
  private trainer: NeuralNetworkTrainer | null = null
  private dataset: DatasetDefinition = DATASETS.xor

  async init(
    layers: HiddenLayer[],
    learningRate: number,
    dataset: DatasetDefinition = DATASETS.xor,
  ) {
    this.nnw = await createNNW()
    this.rebuild(layers, learningRate, dataset)
  }

  rebuild(layers: HiddenLayer[], learningRate: number, dataset = this.dataset) {
    this.dataset = dataset
    this.trainer?.dispose()
    this.model?.dispose()
    this.model = this.nnw.createModel(2)
    for (const layer of layers) this.model.addDense(layer.units, layer.activation)
    this.model.addDense(1, 'sigmoid')
    this.trainer = this.nnw.createTrainer(this.model, {
      optimizer: 'adamw',
      batchSize: Math.min(16, dataset.points.length),
      shuffle: true,
      learningRate,
    })
  }

  train(epochs: number) {
    if (!this.trainer) return []
    const losses: number[] = []
    const inputs = this.dataset.points.flatMap((point) => [point.x, point.y])
    const targets = this.dataset.points.map((point) => point.target)
    for (let epoch = 0; epoch < epochs; epoch++) losses.push(this.trainer.train(inputs, targets))
    return losses
  }

  predictions() {
    const inputs = this.dataset.points.flatMap((point) => [point.x, point.y])
    return this.model ? Array.from(this.model.predict(inputs)) : []
  }

  decisionGrid(resolution = 31): DecisionCell[] {
    if (!this.model) return []
    const inputs: number[] = []
    for (let row = 0; row < resolution; row++) {
      const y = row / (resolution - 1)
      for (let column = 0; column < resolution; column++) {
        const x = column / (resolution - 1)
        inputs.push(x, y)
      }
    }
    const outputs = this.model.predict(inputs)
    return Array.from(outputs, (value, index) => ({
      x: index % resolution,
      y: Math.floor(index / resolution),
      value,
    }))
  }

  dispose() {
    this.trainer?.dispose()
    this.model?.dispose()
  }
}
