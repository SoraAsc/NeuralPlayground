import { Graphics, Container } from 'pixi.js'
import type { Track } from './track-types'

export class TrackRenderer {
  private container: Container
  private trackGraphics: Graphics
  private borderGraphics: Graphics
  private detailGraphics: Graphics

  constructor(parent: Container) {
    this.container = new Container()
    parent.addChild(this.container)

    this.trackGraphics = new Graphics()
    this.borderGraphics = new Graphics()
    this.detailGraphics = new Graphics()

    this.container.addChild(this.trackGraphics)
    this.container.addChild(this.borderGraphics)
    this.container.addChild(this.detailGraphics)
  }

  render(track: Track) {
    this.trackGraphics.clear()
    this.borderGraphics.clear()
    this.detailGraphics.clear()

    if (track.leftBorder.length === 0 || track.rightBorder.length === 0) return

    // Render Background (Grass)
    const padding = 2000
    this.trackGraphics
      .rect(
        track.bounds.minX - padding,
        track.bounds.minY - padding,
        track.bounds.maxX - track.bounds.minX + padding * 2,
        track.bounds.maxY - track.bounds.minY + padding * 2,
      )
      .fill({ color: 0x1a472a })

    // Render Road
    const polygonPoints: number[] = []
    for (const p of track.leftBorder) {
      if (p) polygonPoints.push(p.x, p.y)
    }
    // Add the first point again to ensure the outer border is closed
    if (track.leftBorder[0]) polygonPoints.push(track.leftBorder[0].x, track.leftBorder[0].y)

    // Add right border points in reverse
    for (let i = track.rightBorder.length - 1; i >= 0; i--) {
      const p = track.rightBorder[i]
      if (p) polygonPoints.push(p.x, p.y)
    }
    // Add the last (actually first) point of right border to close
    const lastRb = track.rightBorder[track.rightBorder.length - 1]
    if (lastRb) polygonPoints.push(lastRb.x, lastRb.y)

    if (polygonPoints.length > 0) {
      this.trackGraphics.poly(polygonPoints).fill({ color: 0x333333 })
    }

    // Render Borders
    if (track.leftBorder.length > 0) {
      const lb = track.leftBorder
      const first = lb[0]
      if (first) {
        this.borderGraphics.moveTo(first.x, first.y)
        for (let i = 1; i < lb.length; i++) {
          const p = lb[i]
          if (p) this.borderGraphics.lineTo(p.x, p.y)
        }
        this.borderGraphics.lineTo(first.x, first.y)
      }
    }

    if (track.rightBorder.length > 0) {
      const rb = track.rightBorder
      const first = rb[0]
      if (first) {
        this.borderGraphics.moveTo(first.x, first.y)
        for (let i = 1; i < rb.length; i++) {
          const p = rb[i]
          if (p) this.borderGraphics.lineTo(p.x, p.y)
        }
        this.borderGraphics.lineTo(first.x, first.y)
      }
    }
    this.borderGraphics.stroke({ width: 6, color: 0xdddddd, alpha: 1 })

    // Use border points for precision
    const startIdx = 0
    const lbStart = track.leftBorder[startIdx]
    const rbStart = track.rightBorder[startIdx]

    if (lbStart && rbStart) {
      this.detailGraphics.moveTo(lbStart.x, lbStart.y)
      this.detailGraphics.lineTo(rbStart.x, rbStart.y)
      this.detailGraphics.stroke({ width: 14, color: 0xffff00 })
    }

    // Render Checkpoints (Green)
    track.checkpoints.forEach((cp) => {
      // Use the index stored in the checkpoint which corresponds to its position in the borders
      const lb = track.leftBorder[cp.index]
      const rb = track.rightBorder[cp.index]

      if (lb && rb) {
        this.detailGraphics.moveTo(lb.x, lb.y)
        this.detailGraphics.lineTo(rb.x, rb.y)
      }
    })
    this.detailGraphics.stroke({ width: 6, color: 0x00ff00, alpha: 0.8 })
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}
