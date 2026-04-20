import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getVariableHex(variable: string) {
  const temp = document.createElement('div')
  temp.style.color = `var(${variable})`
  document.body.appendChild(temp)
  const color = getComputedStyle(temp).color
  document.body.removeChild(temp)

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#000000'

  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const data = ctx.getImageData(0, 0, 1, 1).data

  const r = data[0] ?? 0
  const g = data[1] ?? 0
  const b = data[2] ?? 0

  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}
