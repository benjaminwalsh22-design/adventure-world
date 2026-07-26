import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'
import type { DashTheme } from './themes'

/* ---------------------------------------------------------------------------
   DashEngine — themed 2D canvas side-scroller behind <DashGame />.

   Same architecture as GlobeScene: React never re-renders during the RAF
   loop. The engine draws the world on canvas and pushes HUD numbers into
   DOM elements through direct refs. 60fps on iOS Safari.

   Kid-gentle rules:
   - Hitting an obstacle = a stumble (flash + slowdown), never instant fail
   - 3 stumbles ends the run early — retry costs nothing
   - Jump input has a 150ms buffer + 100ms coyote window, because small
     thumbs are not frame-perfect
   ------------------------------------------------------------------------ */

export interface RunResult {
  paws: number
  stumbles: number
  /** meters actually covered (== target on success) */
  meters: number
}

export interface DashHudRefs {
  progressFill: HTMLElement | null
  pawCount: HTMLElement | null
  hearts: HTMLElement | null
}

export interface DashCallbacks {
  onFinish: (result: RunResult) => void
  onFail: (result: RunResult) => void
}

export interface RunConfig {
  level: number
  speed: number // px/s ground scroll
  targetPx: number // run length in px
  duckObstacles: boolean // vultures/branches appear
}

export function getRunConfig(level: number): RunConfig {
  return {
    level,
    speed: Math.min(260 + level * 22, 480),
    targetPx: Math.min(5200 + level * 900, 14000),
    duckObstacles: level >= 2,
  }
}

/** px → display meters (kid-friendly numbers) */
export const PX_PER_METER = 10

const GRAVITY = 2300
const JUMP_VELOCITY = -840
const JUMP_BUFFER_MS = 150
const COYOTE_MS = 100
const STUMBLE_INVINCIBLE_MS = 1300
const MAX_STUMBLES = 3
const MAX_DPR = 2

type ObstacleKind = 'rock' | 'log' | 'vulture' | 'branch'
interface Obstacle {
  kind: ObstacleKind
  x: number // world x (px)
  hit: boolean
}
interface Paw {
  x: number
  yOff: number // height above ground (0 = ground level)
  taken: boolean
}

/** Deterministic PRNG so a retried level is a fair rematch, not a reroll */
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

const NEEDS_JUMP: Record<ObstacleKind, boolean> = {
  rock: true,
  log: true,
  vulture: false,
  branch: false,
}

export class DashEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private container: HTMLElement
  private callbacks: DashCallbacks
  private hud: DashHudRefs = { progressFill: null, pawCount: null, hearts: null }
  private config: RunConfig

  private rafId = 0
  private lastTs = 0
  private disposed = false
  private resizeObserver: ResizeObserver

  private W = 0
  private H = 0

  /* run state */
  private phase: 'ready' | 'running' | 'finished' | 'failed' = 'ready'
  private worldX = 0 // distance scrolled (px)
  private playerY = 0 // 0 = on ground; negative = airborne offset
  private velY = 0
  private ducking = false
  private jumpBufferedAt = -1
  private lastGroundedAt = 0
  private stumbles = 0
  private paws = 0
  private invincibleUntil = 0
  private elapsed = 0
  private finishAnimT = 0

  private obstacles: Obstacle[] = []
  private pawItems: Paw[] = []

  private theme: DashTheme

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    config: RunConfig,
    attempt: number,
    theme: DashTheme,
    callbacks: DashCallbacks,
  ) {
    this.container = container
    this.canvas = canvas
    this.config = config
    this.callbacks = callbacks
    this.theme = theme
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Dash: 2D canvas unavailable')
    this.ctx = ctx

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
    this.handleResize()

    this.buildCourse(config, attempt)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.rafId = requestAnimationFrame(this.tick)
  }

  setHudRefs(refs: DashHudRefs): void {
    this.hud = refs
  }

  /* -- course generation -------------------------------------------------- */

  private buildCourse(config: RunConfig, attempt: number): void {
    const rand = mulberry32(config.level * 7919 + attempt * 104729 + 12345)
    // Reaction gap scales with speed: ~0.8s between hazards, minimum.
    const minGap = config.speed * 0.8 + 160
    let x = 900 // breathing room before the first hazard

    while (x < config.targetPx - 300) {
      const roll = rand()
      if (roll < 0.62) {
        // hazard
        let kind: ObstacleKind
        if (!config.duckObstacles) {
          kind = rand() < 0.5 ? 'rock' : 'log'
        } else {
          const r = rand()
          kind = r < 0.32 ? 'rock' : r < 0.58 ? 'log' : r < 0.8 ? 'vulture' : 'branch'
        }
        this.obstacles.push({ kind, x, hit: false })
      } else {
        // paw arc: 3 pickups, some floating (reward a hop)
        const high = rand() < 0.4
        for (let i = 0; i < 3; i++) {
          this.pawItems.push({ x: x + i * 52, yOff: high ? 90 + Math.sin(i) * 10 : 14, taken: false })
        }
      }
      x += minGap + rand() * minGap * 0.9
    }
  }

  /* -- input (wired to the big touch buttons) ------------------------------ */

  jump(): void {
    if (this.phase !== 'running') return
    this.jumpBufferedAt = this.elapsed
    playSfx('tap')
  }

  duckDown(): void {
    this.ducking = true
  }

  duckUp(): void {
    this.ducking = false
  }

  start(): void {
    if (this.phase === 'ready') {
      this.phase = 'running'
      playSfx('whoosh')
    }
  }

  /* -- e2e/test hook: what's coming, so an autopilot can drive ------------- */

  peek(): { kind: 'jump' | 'duck'; dx: number } | null {
    const next = this.obstacles.find((o) => !o.hit && o.x > this.worldX + this.playerScreenX())
    if (!next) return null
    return {
      kind: NEEDS_JUMP[next.kind] ? 'jump' : 'duck',
      dx: next.x - (this.worldX + this.playerScreenX()),
    }
  }

  getPhase(): string {
    return this.phase
  }

  /* -- physics + collisions ------------------------------------------------ */

  private playerScreenX(): number {
    return this.W * 0.22
  }

  private groundY(): number {
    return this.H * 0.76
  }

  private tick = (ts: number): void => {
    if (this.disposed) return
    const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0.016
    this.lastTs = ts

    if (this.phase === 'running') {
      this.elapsed += dt * 1000
      this.step(dt)
    } else if (this.phase === 'finished') {
      this.finishAnimT += dt
    }

    this.draw()
    this.updateHud()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private step(dt: number): void {
    const speed = this.config.speed
    this.worldX += speed * dt

    /* jumping */
    const grounded = this.playerY >= 0
    if (grounded) {
      this.playerY = 0
      this.velY = 0
      this.lastGroundedAt = this.elapsed
    }
    const buffered = this.jumpBufferedAt >= 0 && this.elapsed - this.jumpBufferedAt < JUMP_BUFFER_MS
    const canJump = grounded || this.elapsed - this.lastGroundedAt < COYOTE_MS
    if (buffered && canJump && !this.ducking) {
      this.velY = JUMP_VELOCITY
      this.jumpBufferedAt = -1
      haptic('tap')
    }
    if (!grounded || this.velY < 0) {
      this.velY += GRAVITY * dt
      this.playerY += this.velY * dt
      if (this.playerY > 0) this.playerY = 0
    }

    /* player hitbox (generous forgiveness for kids) */
    const px = this.playerScreenX()
    const standH = 64
    const duckH = 36
    const h = this.ducking && this.playerY === 0 ? duckH : standH
    const pTop = this.groundY() + this.playerY - h
    const pBox = { x: px - 14, y: pTop + 6, w: 28, h: h - 10 }

    /* obstacles */
    const invincible = this.elapsed < this.invincibleUntil
    for (const o of this.obstacles) {
      const sx = o.x - this.worldX
      if (sx < -80 || sx > this.W + 80) continue
      const box = this.obstacleBox(o, sx)
      if (
        !o.hit &&
        !invincible &&
        pBox.x < box.x + box.w &&
        pBox.x + pBox.w > box.x &&
        pBox.y < box.y + box.h &&
        pBox.y + pBox.h > box.y
      ) {
        o.hit = true
        this.stumbles++
        this.invincibleUntil = this.elapsed + STUMBLE_INVINCIBLE_MS
        playSfx('error')
        haptic('error')
        if (this.stumbles >= MAX_STUMBLES) {
          this.phase = 'failed'
          this.callbacks.onFail(this.result())
          return
        }
      }
    }

    /* paw pickups */
    for (const p of this.pawItems) {
      if (p.taken) continue
      const sx = p.x - this.worldX
      if (sx < -40 || sx > this.W + 40) continue
      const py = this.groundY() - p.yOff - 16
      const dx = sx - px
      const dy = py - (pTop + h / 2)
      if (dx * dx + dy * dy < 48 * 48) {
        p.taken = true
        this.paws++
        playSfx('pop')
      }
    }

    /* finish line */
    if (this.worldX >= this.config.targetPx) {
      this.phase = 'finished'
      playSfx('success')
      haptic('success')
      this.callbacks.onFinish(this.result())
    }
  }

  private obstacleBox(o: Obstacle, sx: number): { x: number; y: number; w: number; h: number } {
    const g = this.groundY()
    // Boxes are ~25% smaller than the art — forgiveness by design.
    switch (o.kind) {
      case 'rock':
        return { x: sx - 18, y: g - 38, w: 36, h: 38 }
      case 'log':
        return { x: sx - 26, y: g - 30, w: 52, h: 30 }
      case 'vulture': {
        const bob = Math.sin((o.x + this.worldX * 0.5) / 60) * 6
        return { x: sx - 20, y: g - 92 + bob, w: 40, h: 30 }
      }
      case 'branch':
        return { x: sx - 34, y: g - 130, w: 68, h: 66 }
    }
  }

  private result(): RunResult {
    return {
      paws: this.paws,
      stumbles: this.stumbles,
      meters: Math.round(Math.min(this.worldX, this.config.targetPx) / PX_PER_METER),
    }
  }

  /* -- drawing ------------------------------------------------------------- */

  private draw(): void {
    const { ctx, W, H } = this
    const g = this.groundY()

    /* sky — warm savanna dawn */
    const sky = ctx.createLinearGradient(0, 0, 0, g)
    sky.addColorStop(0, this.theme.sky[0])
    sky.addColorStop(0.55, this.theme.sky[1])
    sky.addColorStop(1, this.theme.sky[2])
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, g)

    /* sun */
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(W * 0.82, H * 0.16, 34, 0, Math.PI * 2)
    ctx.fill()

    /* distant hills (slow parallax) */
    ctx.fillStyle = this.theme.hillColor
    const hillShift = (this.worldX * 0.15) % (W * 2)
    for (let i = -1; i < 3; i++) {
      const hx = i * W - hillShift + W
      ctx.beginPath()
      ctx.ellipse(hx, g, W * 0.75, H * 0.1, 0, Math.PI, 0)
      ctx.fill()
    }

    /* parallax trees + background animals */
    this.drawParallaxDecor(g)

    /* ground */
    ctx.fillStyle = this.theme.groundColor
    ctx.fillRect(0, g, W, H - g)
    ctx.fillStyle = this.theme.groundStripeColor
    const stripeShift = (this.worldX * 0.9) % 90
    for (let x = -stripeShift; x < W; x += 90) {
      ctx.fillRect(x, g + 26, 48, 6)
    }
    /* grass fringe */
    ctx.fillStyle = this.theme.grassColor
    ctx.fillRect(0, g - 4, W, 8)

    /* paw pickups */
    ctx.font = '26px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.textAlign = 'center'
    for (const p of this.pawItems) {
      if (p.taken) continue
      const sx = p.x - this.worldX
      if (sx < -40 || sx > W + 40) continue
      const bob = Math.sin((this.worldX + p.x) / 90) * 4
      ctx.fillText(this.theme.pickupEmoji, sx, g - p.yOff + bob)
    }

    /* obstacles */
    for (const o of this.obstacles) {
      const sx = o.x - this.worldX
      if (sx < -90 || sx > W + 90) continue
      this.drawObstacle(o, sx, g)
    }

    /* waterhole finish */
    const finishSx = this.config.targetPx - this.worldX + 260
    if (finishSx < W + 300) {
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.ellipse(finishSx, g + 26, 150, 26, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = '40px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
      ctx.fillText(this.theme.finishEmojis[0], finishSx - 60, g - 6)
      ctx.fillText(this.theme.finishEmojis[1], finishSx + 60, g - 2)
      ctx.font = '30px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
      ctx.fillText(this.theme.finishEmojis[2], finishSx, g + 20)
    }

    /* player */
    this.drawPlayer(g)
  }

  private drawParallaxDecor(g: number): void {
    const { ctx, W } = this
    ctx.textAlign = 'center'
    // trees: fixed world positions on a repeating band
    const band = 1400
    ctx.font = '54px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    const treeShift = this.worldX * 0.45
    for (let i = 0; i < 6; i++) {
      const wx = i * band * 0.7 + 300
      const sx = ((wx - treeShift) % (band * 2) + band * 2) % (band * 2) - 100
      if (sx > -80 && sx < W + 80) ctx.fillText(this.theme.treeEmoji, sx, g - 8)
    }
    // background animals amble on a slower layer
    ctx.font = '38px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.globalAlpha = 0.85
    const animals = this.theme.bgAnimals
    const aShift = this.worldX * 0.3
    for (let i = 0; i < animals.length; i++) {
      const wx = i * 1100 + 650
      const sx = ((wx - aShift) % 3300 + 3300) % 3300 - 100
      if (sx > -60 && sx < W + 60) ctx.fillText(animals[i], sx, g - 4)
    }
    ctx.globalAlpha = 1
  }

  private drawObstacle(o: Obstacle, sx: number, g: number): void {
    const { ctx } = this
    ctx.textAlign = 'center'
    switch (o.kind) {
      case 'rock':
        ctx.font = '46px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
        ctx.fillText(this.theme.jumpA, sx, g + 2)
        break
      case 'log':
        ctx.font = '44px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
        ctx.fillText(this.theme.jumpB, sx, g)
        break
      case 'vulture': {
        const bob = Math.sin((o.x + this.worldX * 0.5) / 60) * 6
        ctx.font = '42px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
        ctx.fillText(this.theme.duckFlyer, sx, g - 66 + bob)
        break
      }
      case 'branch':
        // hanging acacia branch: wooden arm from above + leaves at duck height
        ctx.strokeStyle = '#92400e'
        ctx.lineWidth = 10
        ctx.beginPath()
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, g - 108)
        ctx.stroke()
        ctx.font = '46px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
        ctx.fillText(this.theme.duckHangs, sx, g - 78)
        break
    }
  }

  private drawPlayer(g: number): void {
    const { ctx } = this
    const px = this.playerScreenX()
    const invincible = this.elapsed < this.invincibleUntil
    if (invincible && Math.floor(this.elapsed / 90) % 2 === 0) return // flash

    const ducking = this.ducking && this.playerY === 0
    const h = ducking ? 36 : 64
    const y = g + this.playerY // feet position

    ctx.save()
    ctx.translate(px, y)

    /* legs (simple run cycle) */
    if (this.playerY === 0 && this.phase === 'running') {
      const t = this.worldX / 40
      ctx.strokeStyle = '#1e1b4b'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, -14)
      ctx.lineTo(Math.sin(t) * 10, 0)
      ctx.moveTo(0, -14)
      ctx.lineTo(Math.sin(t + Math.PI) * 10, 0)
      ctx.stroke()
    }

    /* body */
    ctx.fillStyle = '#fffbeb'
    const bodyH = h - 26
    ctx.beginPath()
    ctx.roundRect(-13, -14 - bodyH, 26, bodyH, 8)
    ctx.fill()

    /* head + safari hat */
    const headY = -14 - bodyH - 11
    ctx.fillStyle = '#fcd9b8'
    ctx.beginPath()
    ctx.arc(0, headY, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b8a05f'
    ctx.beginPath()
    ctx.ellipse(0, headY - 7, 16, 5, 0, Math.PI, 0)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(-9, headY - 15, 18, 9, 3)
    ctx.fill()

    /* eye looking ahead */
    ctx.fillStyle = '#1e1b4b'
    ctx.beginPath()
    ctx.arc(5, headY - 1, 2, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  /* -- HUD (DOM refs, no React re-renders) --------------------------------- */

  private updateHud(): void {
    const frac = Math.min(this.worldX / this.config.targetPx, 1)
    if (this.hud.progressFill) this.hud.progressFill.style.width = `${(frac * 100).toFixed(1)}%`
    if (this.hud.pawCount) this.hud.pawCount.textContent = String(this.paws)
    if (this.hud.hearts) {
      const left = MAX_STUMBLES - this.stumbles
      this.hud.hearts.textContent = '❤️'.repeat(Math.max(left, 0)) + '🤍'.repeat(this.stumbles)
    }
  }

  /* -- lifecycle ----------------------------------------------------------- */

  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.rafId)
      this.lastTs = 0
    } else if (!this.disposed) {
      this.rafId = requestAnimationFrame(this.tick)
    }
  }

  private handleResize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const { clientWidth, clientHeight } = this.container
    if (clientWidth === 0 || clientHeight === 0) return
    this.W = clientWidth
    this.H = clientHeight
    this.canvas.width = clientWidth * dpr
    this.canvas.height = clientHeight * dpr
    this.canvas.style.width = `${clientWidth}px`
    this.canvas.style.height = `${clientHeight}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
  }
}
