import { createNNW, type NeuralNetwork, type NeuralNetworkTrainer } from 'nnw'

export type RGB = { r: number; g: number; b: number }
export const COLOR_FAMILIES = [
  'Preto',
  'Cinza',
  'Branco',
  'Vermelho',
  'Laranja',
  'Amarelo',
  'Verde',
  'Ciano',
  'Azul',
  'Roxo',
  'Rosa',
] as const
export type ColorFamily = (typeof COLOR_FAMILIES)[number]

const channel = (value: number) => {
  const normalized = value / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

export const relativeLuminance = ({ r, g, b }: RGB) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

export const idealLightText = (color: RGB) => relativeLuminance(color) < 0.179

export const colorFamilyIndex = ({ r, g, b }: RGB) => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const saturation = max === 0 ? 0 : delta / max
  // At the luminance extremes hue differences are barely perceptible, so
  // classify near-black and near-white independently of saturation.
  if (max < 0.12) return 0
  if (min > 0.9) return 2
  if (saturation < 0.16) {
    if (max < 0.2) return 0
    if (max > 0.86) return 2
    return 1
  }

  let hue = 0
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }
  if (hue < 0) hue += 360
  if (hue < 15 || hue >= 345) return 3
  if (hue < 45) return 4
  if (hue < 70) return 5
  if (hue < 165) return 6
  if (hue < 195) return 7
  if (hue < 255) return 8
  if (hue < 290) return 9
  return 10
}

export const colorFamily = (color: RGB): ColorFamily => COLOR_FAMILIES[colorFamilyIndex(color)]!

export const rgbToHex = ({ r, g, b }: RGB) =>
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`

export const hexToRgb = (hex: string): RGB => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
})

const trainingColors = (): RGB[] => {
  const colors: RGB[] = []
  for (let index = 0; index < 384; index++) {
    // Low-discrepancy deterministic RGB samples cover the cube without random state.
    colors.push({
      r: (index * 73) % 256,
      g: (index * 151 + 37) % 256,
      b: (index * 199 + 91) % 256,
    })
  }
  for (let value = 0; value <= 255; value += 5) {
    colors.push({ r: value, g: value, b: value })
    for (const offset of [-8, 8]) {
      colors.push({ r: Math.max(0, Math.min(255, value + offset)), g: value, b: value })
      colors.push({ r: value, g: Math.max(0, Math.min(255, value + offset)), b: value })
      colors.push({ r: value, g: value, b: Math.max(0, Math.min(255, value + offset)) })
    }
  }
  return colors
}

export class ColorPredictorLab {
  private nnw!: Awaited<ReturnType<typeof createNNW>>
  private model: NeuralNetwork | null = null
  private trainer: NeuralNetworkTrainer | null = null
  private readonly colors = trainingColors()
  private readonly inputs = this.colors.flatMap(({ r, g, b }) => [r / 255, g / 255, b / 255])
  private readonly targets = this.colors.flatMap((color) => {
    const target = Array<number>(COLOR_FAMILIES.length).fill(0)
    target[colorFamilyIndex(color)] = 1
    return target
  })

  async init() {
    this.nnw = await createNNW()
    this.reset()
  }

  reset() {
    this.trainer?.dispose()
    this.model?.dispose()
    this.model = this.nnw
      .createModel(3)
      .addDense(16, 'tanh')
      .addDense(12, 'tanh')
      .addDense(COLOR_FAMILIES.length, 'sigmoid')
    this.trainer = this.nnw.createTrainer(this.model, {
      optimizer: 'adamw',
      batchSize: 32,
      shuffle: true,
      learningRate: 0.008,
    })
  }

  train(epochs: number) {
    if (!this.trainer) return []
    return Array.from({ length: epochs }, () => this.trainer!.train(this.inputs, this.targets))
  }

  predict(colors: RGB[]) {
    if (!this.model) return []
    return Array.from(
      this.model.predict(colors.flatMap(({ r, g, b }) => [r / 255, g / 255, b / 255])),
    )
  }

  classify(colors: RGB[]) {
    const values = this.predict(colors)
    return colors.map((_, sampleIndex) => {
      const scores = values.slice(
        sampleIndex * COLOR_FAMILIES.length,
        (sampleIndex + 1) * COLOR_FAMILIES.length,
      )
      const index = scores.reduce(
        (best, value, current) => (value > (scores[best] ?? -Infinity) ? current : best),
        0,
      )
      return { family: COLOR_FAMILIES[index]!, confidence: scores[index] ?? 0, scores }
    })
  }

  accuracy() {
    const predictions = this.classify(this.colors)
    return (
      predictions.filter(({ family }, index) => family === colorFamily(this.colors[index]!))
        .length / this.colors.length
    )
  }

  dispose() {
    this.trainer?.dispose()
    this.model?.dispose()
  }
}
