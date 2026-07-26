import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

/* ---------------------------------------------------------------------------
   SwimEngine — Championship Swim Races.

   A 4-lane Roman aqueduct pool viewed from the side. The whole course maps
   across the screen width so kids always see everyone's position — no
   camera, pure readable race drama. Speed comes from tapping the rhythm
   meter inside the green zone; perfect center taps surge harder.
   ------------------------------------------------------------------------ */

export interface RaceResult {
  placement: 1 | 2 | 3 | 4
  perfects: number
  goods: number
  misses: number
  timeMs: number
}

export interface SwimCallbacks {
  onFinish: (result: RaceResult) => void
  /** Feedback for the tap the player just made */
  onTapFeedback: (quality: 'perfect' | 'good' | 'miss') => void
}

export interface MarkerState {
  /** marker position 0..1 across the meter */
  pos: number
  greenStart: number
  greenEnd: number
}

const RACE_DIST = 2400
const METER_PERIOD_MS = 1100
const BASE_SPEED = 34
const BOOST_GOOD = 60
const BOOST_PERFECT = 88
const BOOST_DECAY = 1.35 // 1/s exponential decay of boost speed
const MISS_DRAG_MS = 550
const MAX_DPR = 2

const LANE_EMOJI = ['🐬', '🏊', '🦆', '🐢'] // player is index 1

interface Swimmer {
  x: number
  boost: number
  finishedAt: number | null
}

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

export class SwimEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private container: HTMLElement
  private callbacks: SwimCallbacks
  private resizeObserver: ResizeObserver
  private rafId = 0
  private lastTs = 0
  private disposed = false
  private W = 0
  private H = 0

  private phase: 'ready' | 'racing' | 'done' = 'ready'
  private elapsed = 0
  private missDragUntil = 0
  private greenStart = 0.38
  private greenWidth = 0.24
  private player: Swimmer = { x: 0, boost: 0, finishedAt: null }
  private ai: Swimmer[] = []
  private aiFactors: number[] = []
  private rand: () => number
  private perfects = 0
  private goods = 0
  private misses = 0
  private splashT = 0

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    raceNumber: number,
    callbacks: SwimCallbacks,
  ) {
    this.container = container
    this.canvas = canvas
    this.callbacks = callbacks
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Swim Races: 2D canvas unavailable')
    this.ctx = ctx
    this.rand = mulberry32(raceNumber * 48271 + 7)

    // AI difficulty climbs with the race number but never becomes unfair:
    // factors are fractions of the player's realistic tap-fueled speed.
    const ramp = Math.min(raceNumber * 0.025, 0.22)
    this.aiFactors = [0.62 + ramp, 0.7 + ramp, 0.55 + ramp]
    this.ai = this.aiFactors.map(() => ({ x: 0, boost: 0, finishedAt: null }))

    // Green zone width narrows slightly as races climb (min 16%)
    this.greenWidth = Math.max(0.24 - raceNumber * 0.008, 0.16)
    this.rollGreenZone()

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
    this.handleResize()
    document.addEventListener('visibilitychange', this.onVisibility)
    this.rafId = requestAnimationFrame(this.tick)
  }

  private rollGreenZone(): void {
    this.greenStart = 0.18 + this.rand() * (0.82 - this.greenWidth - 0.18)
  }

  start(): void {
    if (this.phase === 'ready') {
      this.phase = 'racing'
      playSfx('whoosh')
    }
  }

  getPhase(): string {
    return this.phase
  }

  /** Triangle-wave marker: sweeps right then left, one full cycle per period */
  getMarker(): MarkerState {
    const t = (this.elapsed % METER_PERIOD_MS) / METER_PERIOD_MS
    const pos = t < 0.5 ? t * 2 : 2 - t * 2
    return { pos, greenStart: this.greenStart, greenEnd: this.greenStart + this.greenWidth }
  }

  tap(): void {
    if (this.phase !== 'racing' || this.player.finishedAt !== null) return
    const m = this.getMarker()
    const centre = (m.greenStart + m.greenEnd) / 2
    const half = (m.greenEnd - m.greenStart) / 2
    const dist = Math.abs(m.pos - centre)

    if (dist <= half * 0.45) {
      this.perfects++
      this.player.boost += BOOST_PERFECT
      playSfx('success')
      haptic('success')
      this.callbacks.onTapFeedback('perfect')
    } else if (dist <= half) {
      this.goods++
      this.player.boost += BOOST_GOOD
      playSfx('pop')
      haptic('tap')
      this.callbacks.onTapFeedback('good')
    } else {
      this.misses++
      this.missDragUntil = this.elapsed + MISS_DRAG_MS
      playSfx('error')
      this.callbacks.onTapFeedback('miss')
    }
    this.rollGreenZone()
  }

  /* -- simulation ---------------------------------------------------------- */

  private tick = (ts: number): void => {
    if (this.disposed) return
    const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0.016
    this.lastTs = ts

    if (this.phase === 'racing') {
      this.elapsed += dt * 1000
      this.splashT += dt
      this.step(dt)
    }
    this.draw()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private step(dt: number): void {
    /* player */
    if (this.player.finishedAt === null) {
      const dragging = this.elapsed < this.missDragUntil
      const speed = (BASE_SPEED + this.player.boost) * (dragging ? 0.55 : 1)
      this.player.x += speed * dt
      this.player.boost *= Math.exp(-BOOST_DECAY * dt)
      if (this.player.x >= RACE_DIST) this.player.finishedAt = this.elapsed
    }

    /* AI — smooth speeds around their factor of a realistic player pace */
    const playerPotential = BASE_SPEED + BOOST_GOOD * 0.75
    for (let i = 0; i < this.ai.length; i++) {
      const s = this.ai[i]
      if (s.finishedAt !== null) continue
      const wobble = 1 + Math.sin(this.elapsed / 900 + i * 2.1) * 0.12
      s.x += playerPotential * this.aiFactors[i] * wobble * dt
      if (s.x >= RACE_DIST) s.finishedAt = this.elapsed
    }

    /* race over when the player touches the wall */
    if (this.player.finishedAt !== null) {
      const aheadOfPlayer = this.ai.filter(
        (s) => s.finishedAt !== null && s.finishedAt < this.player.finishedAt!,
      ).length
      this.phase = 'done'
      this.callbacks.onFinish({
        placement: (aheadOfPlayer + 1) as 1 | 2 | 3 | 4,
        perfects: this.perfects,
        goods: this.goods,
        misses: this.misses,
        timeMs: Math.round(this.player.finishedAt),
      })
    }
  }

  /* -- drawing ------------------------------------------------------------- */

  private draw(): void {
    const { ctx, W, H } = this

    /* aqueduct backdrop */
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.3)
    sky.addColorStop(0, '#fde68a')
    sky.addColorStop(1, '#fca55d')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H * 0.3)

    // arches
    ctx.fillStyle = '#d6bfa2'
    ctx.fillRect(0, H * 0.18, W, H * 0.12)
    ctx.fillStyle = '#b49877'
    const archW = 90
    for (let x = 20; x < W; x += archW) {
      ctx.beginPath()
      ctx.arc(x + archW / 2 - 10, H * 0.3, 28, Math.PI, 0)
      ctx.fill()
    }

    /* pool */
    const poolTop = H * 0.3
    const pool = ctx.createLinearGradient(0, poolTop, 0, H)
    pool.addColorStop(0, '#60a5fa')
    pool.addColorStop(1, '#2563eb')
    ctx.fillStyle = pool
    ctx.fillRect(0, poolTop, W, H - poolTop)

    /* lanes */
    const laneCount = 4
    const laneH = (H * 0.52) / laneCount
    const firstLaneY = poolTop + H * 0.05
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.setLineDash([14, 10])
    ctx.lineWidth = 3
    for (let i = 0; i <= laneCount; i++) {
      const y = firstLaneY + i * laneH
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    /* finish wall */
    const finishX = W - 34
    ctx.fillStyle = '#fffbeb'
    ctx.fillRect(finishX + 16, firstLaneY - 8, 8, laneH * laneCount + 16)
    ctx.font = '20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🏁', finishX + 20, firstLaneY - 14)

    /* swimmers — player in lane 2 (index 1) */
    const swimmers: Array<{ s: Swimmer; emoji: string; isPlayer: boolean }> = [
      { s: this.ai[0], emoji: LANE_EMOJI[0], isPlayer: false },
      { s: this.player, emoji: LANE_EMOJI[1], isPlayer: true },
      { s: this.ai[1], emoji: LANE_EMOJI[2], isPlayer: false },
      { s: this.ai[2], emoji: LANE_EMOJI[3], isPlayer: false },
    ]
    ctx.font = '30px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    swimmers.forEach((entry, lane) => {
      const yC = firstLaneY + lane * laneH + laneH / 2
      const bob = Math.sin(this.splashT * 6 + lane) * 3
      const sx = 24 + (Math.min(entry.s.x, RACE_DIST) / RACE_DIST) * (finishX - 40)

      // wake trail
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(Math.max(sx - 46, 6), yC + 6)
      ctx.lineTo(sx - 14, yC + 6)
      ctx.stroke()

      if (entry.isPlayer) {
        ctx.fillStyle = 'rgba(245,158,11,0.35)'
        ctx.beginPath()
        ctx.arc(sx, yC + bob - 4, 24, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillText(entry.emoji, sx, yC + bob + 8)
    })
  }

  /* -- lifecycle ------------------------------------------------------------ */

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
