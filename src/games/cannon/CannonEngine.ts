import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

/* ---------------------------------------------------------------------------
   CannonEngine — Target Cannon Carnival.

   Non-violent carnival physics: a bouncy ball lobbed from a party cannon
   pops balloons and knocks foam blocks off Roman pillars. Angle + power
   come from big DOM sliders; the engine draws a dotted trajectory preview
   so kids can reason about arcs before they fire (sneaky physics lesson).
   ------------------------------------------------------------------------ */

export interface CannonCallbacks {
  onHudChange: (shotsLeft: number, targetsLeft: number) => void
  onCleared: (shotsLeft: number, popped: number) => void
  onOutOfShots: (remaining: number) => void
}

interface Balloon {
  kind: 'balloon'
  x: number
  y: number
  alive: boolean
  hue: number
}
interface Block {
  kind: 'block'
  x: number
  y: number
  alive: boolean
  fallT: number // >0 once knocked, animates falling
  emoji: string
}
type Target = Balloon | Block

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

const GRAVITY = 900
const POWER_SCALE = 8.4
const BALLOON_R = 20
const BLOCK_S = 34
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

const BLOCK_EMOJIS = ['🧸', '🎁', '🏺', '🎪']

export class CannonEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private container: HTMLElement
  private callbacks: CannonCallbacks
  private resizeObserver: ResizeObserver
  private rafId = 0
  private lastTs = 0
  private disposed = false
  private W = 0
  private H = 0

  private angleDeg = 45
  private power = 65
  private shotsLeft: number
  private popped = 0
  private done = false

  private pillars: Array<{ x: number; w: number; h: number }> = []
  private targets: Target[] = []
  private ball: { x: number; y: number; vx: number; vy: number } | null = null
  private particles: Particle[] = []

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    level: number,
    callbacks: CannonCallbacks,
  ) {
    this.container = container
    this.canvas = canvas
    this.callbacks = callbacks
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Target Cannon: 2D canvas unavailable')
    this.ctx = ctx

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
    this.handleResize()

    this.buildLevel(level)
    this.shotsLeft = this.targets.length + 3
    this.emitHud()

    document.addEventListener('visibilitychange', this.onVisibility)
    this.rafId = requestAnimationFrame(this.tick)
  }

  /* -- level layout (in fractions of screen, resolved at draw time) -------- */

  private buildLevel(level: number): void {
    const rand = mulberry32(level * 65537 + 11)
    const pillarCount = Math.min(2 + Math.floor(level / 2), 4)
    const targetsWanted = Math.min(3 + level, 8)

    for (let i = 0; i < pillarCount; i++) {
      this.pillars.push({
        x: 0.42 + (i / pillarCount) * 0.52 + rand() * 0.04,
        w: 0.09,
        h: 0.16 + rand() * 0.22,
      })
    }
    let placed = 0
    let pi = 0
    while (placed < targetsWanted) {
      const p = this.pillars[pi % this.pillars.length]
      pi++
      if (rand() < 0.55) {
        this.targets.push({
          kind: 'balloon',
          x: p.x + (rand() - 0.5) * 0.05,
          // height above ground (fraction) — capped inside the cannon's
          // reachable arc envelope, then verified below
          y: Math.min(p.h + 0.1 + rand() * 0.12, 0.38),
          alive: true,
          hue: Math.floor(rand() * 360),
        })
      } else {
        this.targets.push({
          kind: 'block',
          x: p.x + (rand() - 0.5) * 0.03,
          y: p.h + 0.035,
          alive: true,
          fallT: 0,
          emoji: BLOCK_EMOJIS[Math.floor(rand() * BLOCK_EMOJIS.length)],
        })
      }
      placed++
    }

    /* Fairness guarantee: every target must be hittable by SOME slider
       combo. Any target the physics can't reach gets lowered until it can
       be. This can never fail silently into an unwinnable level. */
    if (this.W > 0) {
      for (const t of this.targets) {
        let guard = 0
        while (guard++ < 12 && !this.reachable(t)) {
          t.y = Math.max(t.y - 0.04, 0.05)
          if (t.y <= 0.05) break
        }
      }
    }
  }

  private reachable(target: Target): boolean {
    for (let a = 20; a <= 78; a += 4) {
      for (let p = 25; p <= 100; p += 5) {
        if (this.simulate(a, p, target)) return true
      }
    }
    return false
  }

  /* -- aim + fire ----------------------------------------------------------- */

  setAngle(deg: number): void {
    this.angleDeg = Math.min(Math.max(deg, 15), 80)
  }

  setPower(p: number): void {
    this.power = Math.min(Math.max(p, 20), 100)
  }

  getAim(): { angle: number; power: number } {
    return { angle: this.angleDeg, power: this.power }
  }

  canFire(): boolean {
    return !this.ball && this.shotsLeft > 0 && !this.done
  }

  fire(): void {
    if (!this.canFire()) return
    this.shotsLeft--
    const m = this.muzzle()
    const rad = (this.angleDeg * Math.PI) / 180
    const v = this.power * POWER_SCALE
    this.ball = { x: m.x, y: m.y, vx: Math.cos(rad) * v, vy: -Math.sin(rad) * v }
    playSfx('whoosh')
    haptic('tap')
    this.emitHud()
  }

  /* -- test hooks ------------------------------------------------------------ */

  /** Pure simulation: would (angle, power) hit a living target?
   *  Pass `only` to test reachability of one specific target. */
  simulate(angleDeg: number, power: number, only?: Target): boolean {
    const m = this.muzzle()
    const rad = (angleDeg * Math.PI) / 180
    const v = power * POWER_SCALE
    let x = m.x
    let y = m.y
    let vx = Math.cos(rad) * v
    let vy = -Math.sin(rad) * v
    const dt = 1 / 120
    for (let i = 0; i < 600; i++) {
      vy += GRAVITY * dt
      x += vx * dt
      y += vy * dt
      if (y > this.groundY() || x > this.W + 40) return false
      for (const t of this.targets) {
        if (only && t !== only) continue
        if (!only && !t.alive) continue
        const tp = this.targetPos(t)
        if (t.kind === 'balloon') {
          if (Math.hypot(x - tp.x, y - tp.y) < BALLOON_R + 8) return true
        } else if (
          x > tp.x - BLOCK_S / 2 - 8 &&
          x < tp.x + BLOCK_S / 2 + 8 &&
          y > tp.y - BLOCK_S - 8 &&
          y < tp.y + 8
        ) {
          return true
        }
      }
    }
    return false
  }

  targetsLeft(): number {
    return this.targets.filter((t) => t.alive).length
  }

  /* -- geometry -------------------------------------------------------------- */

  private groundY(): number {
    return this.H * 0.86
  }

  private muzzle(): { x: number; y: number } {
    return { x: 54, y: this.groundY() - 46 }
  }

  private targetPos(t: Target): { x: number; y: number } {
    return { x: t.x * this.W, y: this.groundY() - t.y * this.H }
  }

  /* -- simulation ------------------------------------------------------------- */

  private tick = (ts: number): void => {
    if (this.disposed) return
    const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0.016
    this.lastTs = ts
    this.step(dt)
    this.draw()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private step(dt: number): void {
    /* falling blocks + particles animate regardless */
    for (const t of this.targets) {
      if (t.kind === 'block' && !t.alive && t.fallT < 2) t.fallT += dt
    }
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0)
    for (const p of this.particles) {
      p.vy += 600 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }

    if (!this.ball) return
    const b = this.ball

    /* Fixed 1/120s substeps: a fast ball can cross a whole balloon in one
       slow frame, tunneling straight through discrete collision checks.
       Substepping kills tunneling on every device AND keeps the live
       flight identical to the simulate() preview physics. */
    const SUBSTEP = 1 / 120
    let remaining = dt
    let left = false
    while (remaining > 0 && this.ball) {
      const h = Math.min(remaining, SUBSTEP)
      remaining -= h
      b.vy += GRAVITY * h
      b.x += b.vx * h
      b.y += b.vy * h

      for (const t of this.targets) {
        if (!t.alive) continue
        const tp = this.targetPos(t)
        let hit = false
        if (t.kind === 'balloon') {
          hit = Math.hypot(b.x - tp.x, b.y - tp.y) < BALLOON_R + 10
        } else {
          hit =
            b.x > tp.x - BLOCK_S / 2 - 10 &&
            b.x < tp.x + BLOCK_S / 2 + 10 &&
            b.y > tp.y - BLOCK_S - 10 &&
            b.y < tp.y + 10
        }
        if (hit) {
          t.alive = false
          this.popped++
          playSfx('pop')
          haptic('success')
          this.burst(
            tp.x,
            tp.y,
            t.kind === 'balloon' ? `hsl(${(t as Balloon).hue} 90% 60%)` : '#f59e0b',
          )
          this.emitHud()
        }
      }

      if (b.y > this.groundY() - 6 || b.x > this.W + 30 || b.x < -30) {
        left = true
        break
      }
    }

    /* ball leaves play */
    if (left) {
      this.ball = null
      const left = this.targetsLeft()
      if (left === 0 && !this.done) {
        this.done = true
        playSfx('reward')
        haptic('reward')
        this.callbacks.onCleared(this.shotsLeft, this.popped)
      } else if (this.shotsLeft === 0 && !this.done) {
        this.done = true
        this.callbacks.onOutOfShots(left)
      }
    }
  }

  private burst(x: number, y: number, color: string): void {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * (120 + (i % 3) * 60),
        vy: Math.sin(a) * (120 + (i % 3) * 60) - 80,
        life: 0.7,
        color,
      })
    }
  }

  private emitHud(): void {
    this.callbacks.onHudChange(this.shotsLeft, this.targetsLeft())
  }

  /* -- drawing ----------------------------------------------------------------- */

  private draw(): void {
    const { ctx, W, H } = this
    const g = this.groundY()

    /* carnival sky */
    const sky = ctx.createLinearGradient(0, 0, 0, g)
    sky.addColorStop(0, '#818cf8')
    sky.addColorStop(1, '#fbcfe8')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, g)

    /* bunting */
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 60)
    ctx.quadraticCurveTo(W / 2, 110, W, 60)
    ctx.stroke()
    for (let i = 0; i < 9; i++) {
      const t = i / 8
      const x = t * W
      const y = 60 + Math.sin(Math.PI * t) * 48
      ctx.fillStyle = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6'][i % 4]
      ctx.beginPath()
      ctx.moveTo(x - 8, y)
      ctx.lineTo(x + 8, y)
      ctx.lineTo(x, y + 16)
      ctx.closePath()
      ctx.fill()
    }

    /* ground */
    ctx.fillStyle = '#a3ba58'
    ctx.fillRect(0, g, W, H - g)

    /* pillars */
    for (const p of this.pillars) {
      const px = p.x * W
      const ph = p.h * H
      const pw = p.w * W
      ctx.fillStyle = '#efe3c4'
      ctx.fillRect(px - pw / 2, g - ph, pw, ph)
      ctx.fillStyle = '#d9c8a2'
      ctx.fillRect(px - pw / 2 - 6, g - ph - 10, pw + 12, 10)
      ctx.fillRect(px - pw / 2 - 6, g - 10, pw + 12, 10)
      // flutes
      ctx.strokeStyle = 'rgba(140,120,80,0.35)'
      ctx.lineWidth = 2
      for (let i = 1; i < 4; i++) {
        ctx.beginPath()
        ctx.moveTo(px - pw / 2 + (pw / 4) * i, g - ph + 4)
        ctx.lineTo(px - pw / 2 + (pw / 4) * i, g - 4)
        ctx.stroke()
      }
    }

    /* targets */
    for (const t of this.targets) {
      const tp = this.targetPos(t)
      if (t.kind === 'balloon') {
        if (!t.alive) continue
        const bob = Math.sin(performance.now() / 500 + t.hue) * 4
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(tp.x, tp.y + bob + BALLOON_R)
        ctx.lineTo(tp.x, tp.y + bob + BALLOON_R + 22)
        ctx.stroke()
        ctx.fillStyle = `hsl(${t.hue} 90% 62%)`
        ctx.beginPath()
        ctx.ellipse(tp.x, tp.y + bob, BALLOON_R * 0.85, BALLOON_R, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.beginPath()
        ctx.ellipse(tp.x - 6, tp.y + bob - 6, 5, 8, -0.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const fallY = t.alive ? 0 : Math.min(t.fallT * t.fallT * 500, this.H)
        const spin = t.alive ? 0 : t.fallT * 4
        ctx.save()
        ctx.translate(tp.x, tp.y - BLOCK_S / 2 + fallY)
        ctx.rotate(spin)
        ctx.font = `${BLOCK_S}px "Apple Color Emoji", "Noto Color Emoji", sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(t.emoji, 0, BLOCK_S / 2 - 4)
        ctx.restore()
      }
    }

    /* trajectory preview (dotted) */
    if (!this.ball && this.shotsLeft > 0 && !this.done) {
      const m = this.muzzle()
      const rad = (this.angleDeg * Math.PI) / 180
      const v = this.power * POWER_SCALE
      let x = m.x
      let y = m.y
      let vx = Math.cos(rad) * v
      let vy = -Math.sin(rad) * v
      ctx.fillStyle = 'rgba(255,251,235,0.65)'
      const dt = 1 / 60
      for (let i = 0; i < 70; i++) {
        vy += GRAVITY * dt
        x += vx * dt
        y += vy * dt
        if (y > g || x > W) break
        if (i % 5 === 0) {
          ctx.beginPath()
          ctx.arc(x, y, 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    /* cannon */
    const m = this.muzzle()
    ctx.save()
    ctx.translate(m.x, m.y)
    ctx.rotate((-this.angleDeg * Math.PI) / 180)
    ctx.fillStyle = '#1e1b4b'
    ctx.beginPath()
    ctx.roundRect(-12, -13, 58, 26, 10)
    ctx.fill()
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(38, -13, 8, 26)
    ctx.restore()
    // wheel
    ctx.fillStyle = '#b45309'
    ctx.beginPath()
    ctx.arc(m.x - 4, m.y + 26, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#78350f'
    ctx.beginPath()
    ctx.arc(m.x - 4, m.y + 26, 8, 0, Math.PI * 2)
    ctx.fill()

    /* ball */
    if (this.ball) {
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(this.ball.x, this.ball.y, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc(this.ball.x - 3, this.ball.y - 3, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    /* pop particles */
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(p.life / 0.7, 0)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /* -- lifecycle ----------------------------------------------------------------- */

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
