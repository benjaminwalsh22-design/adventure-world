import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'
import { paintScene, PUZZLE_IMG_H, PUZZLE_IMG_W } from './puzzleArt'
import type { SceneKey } from './puzzleArt'

/* ---------------------------------------------------------------------------
   PuzzleEngine — jigsaw board with pinch-zoom, pan, drag-snap pieces.

   World space = image space (800×600). A view transform (scale + offset)
   maps world→screen. One finger drags a piece (or pans on empty space);
   two fingers pinch-zoom. Pieces snap to their cell with a magnet SFX
   when released close enough; the 1000-piece mega mode widens the magnet
   so tiny pieces stay fun instead of fiddly.
   ------------------------------------------------------------------------ */

export interface PuzzleOpts {
  cols: number
  rows: number
  scene: SceneKey
  ghost: boolean
  /** snap radius as a fraction of cell size */
  snapFactor: number
}

export interface PuzzleCallbacks {
  onPlaced: (placed: number, total: number) => void
  onComplete: () => void
}

interface Piece {
  id: number
  cx: number
  cy: number
  x: number // current world pos (top-left)
  y: number
  locked: boolean
}

const MAX_DPR = 2

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class PuzzleEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private container: HTMLElement
  private opts: PuzzleOpts
  private callbacks: PuzzleCallbacks
  private image: HTMLCanvasElement
  private resizeObserver: ResizeObserver
  private rafId = 0
  private disposed = false
  private W = 0
  private H = 0

  private pieces: Piece[] = []
  private cw: number
  private ch: number

  /* view transform: screen = world * scale + (ox, oy) */
  private scale = 1
  private ox = 0
  private oy = 0
  private fitScale = 1

  /* input */
  private pointers = new Map<number, { x: number; y: number }>()
  private dragging: Piece | null = null
  private dragOffset = { x: 0, y: 0 }
  private pinchStart: { dist: number; scale: number; mid: { x: number; y: number } } | null = null

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    opts: PuzzleOpts,
    callbacks: PuzzleCallbacks,
  ) {
    this.container = container
    this.canvas = canvas
    this.opts = opts
    this.callbacks = callbacks
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Puzzle Quest: 2D canvas unavailable')
    this.ctx = ctx
    this.image = paintScene(opts.scene)
    this.cw = PUZZLE_IMG_W / opts.cols
    this.ch = PUZZLE_IMG_H / opts.rows

    /* scatter pieces around the board, deterministic per board size */
    const rand = mulberry32(opts.cols * 31 + opts.rows * 137 + 5)
    for (let cy = 0; cy < opts.rows; cy++) {
      for (let cx = 0; cx < opts.cols; cx++) {
        this.pieces.push({
          id: cy * opts.cols + cx,
          cx,
          cy,
          x: -PUZZLE_IMG_W * 0.3 + rand() * PUZZLE_IMG_W * 1.6 - this.cw / 2,
          y: PUZZLE_IMG_H * 1.05 + rand() * PUZZLE_IMG_H * 0.45,
          locked: false,
        })
      }
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
    this.handleResize()
    this.bindEvents()
    document.addEventListener('visibilitychange', this.onVisibility)
    this.rafId = requestAnimationFrame(this.tick)
  }

  /* -- coordinate mapping --------------------------------------------------- */

  private toWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.ox) / this.scale, y: (sy - this.oy) / this.scale }
  }

  resetView(): void {
    // Fit the board + scatter area
    const worldW = PUZZLE_IMG_W * 1.7
    const worldH = PUZZLE_IMG_H * 1.75
    this.fitScale = Math.min(this.W / worldW, this.H / worldH)
    this.scale = this.fitScale
    this.ox = (this.W - worldW * this.scale) / 2 + PUZZLE_IMG_W * 0.35 * this.scale
    this.oy = this.H * 0.06
  }

  /* -- input ---------------------------------------------------------------- */

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onDown)
    this.canvas.addEventListener('pointermove', this.onMove)
    this.canvas.addEventListener('pointerup', this.onUp)
    this.canvas.addEventListener('pointercancel', this.onUp)
  }

  private canvasPos(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId)
    const p = this.canvasPos(e)
    this.pointers.set(e.pointerId, p)

    if (this.pointers.size === 2) {
      // entering pinch: drop any piece drag, remember baseline
      this.dragging = null
      const [a, b] = [...this.pointers.values()]
      this.pinchStart = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: this.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      }
      return
    }

    // single pointer: grab topmost unlocked piece under finger, else pan
    const w = this.toWorld(p.x, p.y)
    const grabPad = Math.max(this.cw, this.ch) * 0.2 // fat-finger forgiveness
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i]
      if (piece.locked) continue
      if (
        w.x >= piece.x - grabPad &&
        w.x <= piece.x + this.cw + grabPad &&
        w.y >= piece.y - grabPad &&
        w.y <= piece.y + this.ch + grabPad
      ) {
        this.dragging = piece
        this.dragOffset = { x: w.x - piece.x, y: w.y - piece.y }
        // raise to top
        this.pieces.splice(i, 1)
        this.pieces.push(piece)
        playSfx('tap')
        return
      }
    }
    this.dragging = null // pan mode
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return
    const prev = this.pointers.get(e.pointerId)!
    const p = this.canvasPos(e)
    this.pointers.set(e.pointerId, p)

    if (this.pointers.size >= 2 && this.pinchStart) {
      const [a, b] = [...this.pointers.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const worldAtMid = this.toWorld(this.pinchStart.mid.x, this.pinchStart.mid.y)
      const newScale = Math.min(
        Math.max((this.pinchStart.scale * dist) / Math.max(this.pinchStart.dist, 1), this.fitScale * 0.5),
        this.fitScale * 6,
      )
      this.scale = newScale
      // keep the pinch midpoint anchored on the same world point
      this.ox = mid.x - worldAtMid.x * this.scale
      this.oy = mid.y - worldAtMid.y * this.scale
      return
    }

    if (this.dragging) {
      const w = this.toWorld(p.x, p.y)
      this.dragging.x = w.x - this.dragOffset.x
      this.dragging.y = w.y - this.dragOffset.y
    } else {
      // pan
      this.ox += p.x - prev.x
      this.oy += p.y - prev.y
    }
  }

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinchStart = null

    if (this.dragging && this.pointers.size === 0) {
      this.tryPlace(this.dragging)
      this.dragging = null
    }
  }

  private tryPlace(piece: Piece): void {
    const tx = piece.cx * this.cw
    const ty = piece.cy * this.ch
    const snap = Math.max(this.cw, this.ch) * this.opts.snapFactor
    if (Math.hypot(piece.x - tx, piece.y - ty) < snap) {
      piece.x = tx
      piece.y = ty
      piece.locked = true
      playSfx('magnet')
      haptic('success')
      // locked pieces sink to the bottom of the z-order
      const i = this.pieces.indexOf(piece)
      this.pieces.splice(i, 1)
      this.pieces.unshift(piece)
      const placed = this.pieces.filter((p) => p.locked).length
      this.callbacks.onPlaced(placed, this.pieces.length)
      if (placed === this.pieces.length) this.callbacks.onComplete()
    }
  }

  /* -- test hooks ----------------------------------------------------------- */

  listPieces(): Array<{ id: number; locked: boolean }> {
    return this.pieces.map((p) => ({ id: p.id, locked: p.locked }))
  }

  /** e2e: screen coords for a piece's centre and its target centre */
  pieceScreenInfo(id: number): { from: [number, number]; to: [number, number] } | null {
    const p = this.pieces.find((pc) => pc.id === id)
    if (!p) return null
    const fx = (p.x + this.cw / 2) * this.scale + this.ox
    const fy = (p.y + this.ch / 2) * this.scale + this.oy
    const tx = (p.cx * this.cw + this.cw / 2) * this.scale + this.ox
    const ty = (p.cy * this.ch + this.ch / 2) * this.scale + this.oy
    return { from: [fx, fy], to: [tx, ty] }
  }

  /** e2e fast-forward: place every remaining piece through the real path */
  autoSolve(): void {
    for (const p of [...this.pieces]) {
      if (!p.locked) {
        p.x = p.cx * this.cw
        p.y = p.cy * this.ch
        this.tryPlace(p)
      }
    }
  }

  /* -- render ---------------------------------------------------------------- */

  private tick = (): void => {
    if (this.disposed) return
    this.draw()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private draw(): void {
    const { ctx, W, H } = this
    ctx.fillStyle = '#1e1b4b'
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    ctx.translate(this.ox, this.oy)
    ctx.scale(this.scale, this.scale)

    /* board backing + ghost guide */
    ctx.fillStyle = '#fffbeb'
    ctx.fillRect(-8, -8, PUZZLE_IMG_W + 16, PUZZLE_IMG_H + 16)
    if (this.opts.ghost) {
      ctx.globalAlpha = 0.18
      ctx.drawImage(this.image, 0, 0)
      ctx.globalAlpha = 1
    }
    /* cell grid */
    ctx.strokeStyle = 'rgba(30,27,75,0.12)'
    ctx.lineWidth = 1 / this.scale
    for (let c = 0; c <= this.opts.cols; c++) {
      ctx.beginPath()
      ctx.moveTo(c * this.cw, 0)
      ctx.lineTo(c * this.cw, PUZZLE_IMG_H)
      ctx.stroke()
    }
    for (let r = 0; r <= this.opts.rows; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * this.ch)
      ctx.lineTo(PUZZLE_IMG_W, r * this.ch)
      ctx.stroke()
    }

    /* pieces (locked first in array → drawn under) */
    for (const p of this.pieces) {
      const sx = p.cx * this.cw
      const sy = p.cy * this.ch
      if (p.locked) {
        ctx.drawImage(this.image, sx, sy, this.cw, this.ch, p.x, p.y, this.cw, this.ch)
        continue
      }
      const isDragged = p === this.dragging
      ctx.save()
      if (isDragged) {
        ctx.shadowColor = 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = 16 / this.scale
        ctx.shadowOffsetY = 6 / this.scale
      }
      const r = Math.min(this.cw, this.ch) * 0.14
      ctx.beginPath()
      ctx.roundRect(p.x, p.y, this.cw, this.ch, r)
      ctx.clip()
      ctx.drawImage(this.image, sx, sy, this.cw, this.ch, p.x, p.y, this.cw, this.ch)
      ctx.restore()
      ctx.strokeStyle = isDragged ? '#f59e0b' : 'rgba(255,251,235,0.9)'
      ctx.lineWidth = (isDragged ? 3 : 1.6) / this.scale
      ctx.beginPath()
      ctx.roundRect(p.x, p.y, this.cw, this.ch, r)
      ctx.stroke()
    }

    ctx.restore()
  }

  /* -- lifecycle -------------------------------------------------------------- */

  private onVisibility = (): void => {
    if (document.hidden) cancelAnimationFrame(this.rafId)
    else if (!this.disposed) this.rafId = requestAnimationFrame(this.tick)
  }

  private handleResize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const { clientWidth, clientHeight } = this.container
    if (clientWidth === 0 || clientHeight === 0) return
    const firstSize = this.W === 0
    this.W = clientWidth
    this.H = clientHeight
    this.canvas.width = clientWidth * dpr
    this.canvas.height = clientHeight * dpr
    this.canvas.style.width = `${clientWidth}px`
    this.canvas.style.height = `${clientHeight}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (firstSize) this.resetView()
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onUp)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }
}
