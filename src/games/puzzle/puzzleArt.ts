/**
 * Procedurally painted puzzle pictures — bright Rome postcards drawn on an
 * offscreen canvas. Zero image downloads, crisp at any piece count.
 */

export const PUZZLE_IMG_W = 800
export const PUZZLE_IMG_H = 600

export type SceneKey = 'colosseum' | 'vesuvius' | 'forum'

export const SCENES: Array<{ key: SceneKey; name: string; emoji: string }> = [
  { key: 'colosseum', name: 'The Mighty Colosseum', emoji: '🏛️' },
  { key: 'vesuvius', name: 'Vesuvius Bay', emoji: '🌋' },
  { key: 'forum', name: 'The Roman Forum', emoji: '⛲' },
]

function emoji(ctx: CanvasRenderingContext2D, glyph: string, x: number, y: number, size: number) {
  ctx.font = `${size}px "Apple Color Emoji", "Noto Color Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(glyph, x, y)
}

export function paintScene(key: SceneKey): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PUZZLE_IMG_W
  canvas.height = PUZZLE_IMG_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Puzzle Quest: 2D canvas unavailable')
  const W = PUZZLE_IMG_W
  const H = PUZZLE_IMG_H

  if (key === 'colosseum') {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7)
    sky.addColorStop(0, '#60a5fa')
    sky.addColorStop(1, '#bae6fd')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(W * 0.85, H * 0.15, 46, 0, Math.PI * 2)
    ctx.fill()
    // ground
    ctx.fillStyle = '#a3ba58'
    ctx.fillRect(0, H * 0.72, W, H * 0.28)
    // colosseum body
    ctx.fillStyle = '#e7d3ae'
    ctx.beginPath()
    ctx.ellipse(W / 2, H * 0.72, 300, 60, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(W / 2 - 300, H * 0.38, 600, H * 0.34)
    ctx.fillStyle = '#d9bd8d'
    ctx.beginPath()
    ctx.ellipse(W / 2, H * 0.38, 300, 50, 0, Math.PI, 0)
    ctx.fill()
    // arch rows
    ctx.fillStyle = '#8a6f47'
    for (let row = 0; row < 3; row++) {
      const y = H * (0.45 + row * 0.1)
      for (let i = 0; i < 11; i++) {
        const x = W / 2 - 275 + i * 55
        ctx.beginPath()
        ctx.arc(x + 14, y + 16, 14, Math.PI, 0)
        ctx.rect(x, y + 16, 28, 18)
        ctx.fill()
      }
    }
    emoji(ctx, '🌳', W * 0.08, H * 0.75, 90)
    emoji(ctx, '🌳', W * 0.93, H * 0.77, 100)
    emoji(ctx, '🚩', W * 0.5, H * 0.34, 50)
    emoji(ctx, '⛅', W * 0.2, H * 0.16, 70)
  } else if (key === 'vesuvius') {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.65)
    sky.addColorStop(0, '#fda4af')
    sky.addColorStop(0.5, '#fdba74')
    sky.addColorStop(1, '#fde68a')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fb923c'
    ctx.beginPath()
    ctx.arc(W * 0.5, H * 0.6, 55, 0, Math.PI * 2)
    ctx.fill()
    // volcano
    ctx.fillStyle = '#57534e'
    ctx.beginPath()
    ctx.moveTo(W * 0.12, H * 0.62)
    ctx.lineTo(W * 0.34, H * 0.2)
    ctx.lineTo(W * 0.42, H * 0.2)
    ctx.lineTo(W * 0.64, H * 0.62)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#78716c'
    ctx.beginPath()
    ctx.moveTo(W * 0.34, H * 0.2)
    ctx.lineTo(W * 0.38, H * 0.32)
    ctx.lineTo(W * 0.42, H * 0.2)
    ctx.closePath()
    ctx.fill()
    emoji(ctx, '💨', W * 0.38, H * 0.15, 70)
    // sea
    const sea = ctx.createLinearGradient(0, H * 0.62, 0, H)
    sea.addColorStop(0, '#38bdf8')
    sea.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = sea
    ctx.fillRect(0, H * 0.62, W, H * 0.38)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 4
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.moveTo(W * 0.1 + i * 120, H * (0.7 + (i % 3) * 0.08))
      ctx.lineTo(W * 0.1 + i * 120 + 70, H * (0.7 + (i % 3) * 0.08))
      ctx.stroke()
    }
    emoji(ctx, '⛵', W * 0.75, H * 0.78, 90)
    emoji(ctx, '🐬', W * 0.25, H * 0.85, 60)
    emoji(ctx, '🕊️', W * 0.8, H * 0.25, 50)
  } else {
    // forum
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7)
    sky.addColorStop(0, '#93c5fd')
    sky.addColorStop(1, '#e0f2fe')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(W * 0.15, H * 0.15, 44, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b6c98a'
    ctx.fillRect(0, H * 0.68, W, H * 0.32)
    // temple pediment
    ctx.fillStyle = '#efe3c4'
    ctx.beginPath()
    ctx.moveTo(W * 0.5 - 260, H * 0.3)
    ctx.lineTo(W * 0.5, H * 0.14)
    ctx.lineTo(W * 0.5 + 260, H * 0.3)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(W * 0.5 - 260, H * 0.3, 520, 26)
    // columns
    ctx.fillStyle = '#f5ead0'
    for (let i = 0; i < 7; i++) {
      const x = W * 0.5 - 234 + i * 78
      ctx.fillRect(x, H * 0.36, 36, H * 0.32)
      ctx.fillRect(x - 6, H * 0.34, 48, 12)
      ctx.fillRect(x - 6, H * 0.66, 48, 12)
    }
    emoji(ctx, '⛲', W * 0.16, H * 0.85, 110)
    emoji(ctx, '🌸', W * 0.85, H * 0.8, 70)
    emoji(ctx, '🕊️', W * 0.68, H * 0.12, 54)
    emoji(ctx, '🏺', W * 0.88, H * 0.92, 64)
  }

  return canvas
}
