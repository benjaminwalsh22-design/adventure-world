import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarkerState, RaceResult } from './SwimEngine'
import { SwimEngine } from './SwimEngine'
import { Button3D } from '../../components/ui/Button3D'
import type { RewardBannerData } from '../../components/ui/RewardBanner'
import { useProgressStore } from '../../state/useProgressStore'
import { useRewardsStore } from '../../state/useRewardsStore'
import type { MedalTier } from '../../state/useRewardsStore'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

interface GameScreenProps {
  onExit: () => void
  onReward: (banner: RewardBannerData) => void
}

const MEDAL_FOR_PLACE: Record<number, MedalTier | null> = {
  1: 'gold',
  2: 'silver',
  3: 'bronze',
  4: null,
}

const MEDAL_EMOJI: Record<MedalTier, string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
  diamond: '💎',
}

const PLACE_LABEL: Record<number, string> = {
  1: '1st place!',
  2: '2nd place!',
  3: '3rd place!',
  4: '4th place',
}

interface RaceOutcome {
  result: RaceResult
  medal: MedalTier | null
  coins: number
}

export default function SwimRaces({ onExit, onReward }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SwimEngine | null>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const greenRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const [race, setRace] = useState(() => useProgressStore.getState().swimRace)
  const [attempt, setAttempt] = useState(1)
  const [phase, setPhase] = useState<'ready' | 'racing' | 'done'>('ready')
  const [feedback, setFeedback] = useState<'perfect' | 'good' | 'miss' | null>(null)
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null)
  const feedbackTimer = useRef(0)

  const handleFinish = useCallback(
    (result: RaceResult): void => {
      const rewards = useRewardsStore.getState()
      let medal = MEDAL_FOR_PLACE[result.placement]
      // Diamond: flawless victory — gold pace with perfect-heavy tapping
      if (medal === 'gold' && result.perfects >= 8 && result.misses === 0) medal = 'diamond'

      const coins = 6 + Math.max(4 - result.placement, 0) * 6 + result.perfects
      rewards.addCoins(coins)

      if (medal) {
        rewards.awardMedal({
          tier: medal,
          eventName: `Aqueduct Sprint #${race}`,
          cityId: 'rome',
        })
        onReward({
          emoji: MEDAL_EMOJI[medal],
          headline:
            medal === 'diamond' ? 'DIAMOND medal — flawless swim!' : `You won a ${medal} medal!`,
          sub: 'See it shine in your Trophy Room',
        })
        useProgressStore.getState().advanceSwim()
      } else {
        playSfx('reward')
        haptic('success')
      }

      setOutcome({ result, medal, coins })
      setPhase('done')
    },
    [race, onReward],
  )

  const handleFinishRef = useRef(handleFinish)
  handleFinishRef.current = handleFinish

  /* engine per (race, attempt) */
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const engine = new SwimEngine(container, canvas, race, {
      onFinish: (r) => handleFinishRef.current(r),
      onTapFeedback: (q) => {
        setFeedback(q)
        window.clearTimeout(feedbackTimer.current)
        feedbackTimer.current = window.setTimeout(() => setFeedback(null), 650)
      },
    })
    engineRef.current = engine
    ;(window as unknown as { __awSwim?: SwimEngine }).__awSwim = engine

    /* meter marker follows the engine at 60fps via direct DOM writes */
    const drive = () => {
      const m: MarkerState | undefined = engineRef.current?.getMarker()
      if (m && markerRef.current && greenRef.current) {
        markerRef.current.style.left = `${(m.pos * 100).toFixed(2)}%`
        greenRef.current.style.left = `${(m.greenStart * 100).toFixed(2)}%`
        greenRef.current.style.width = `${((m.greenEnd - m.greenStart) * 100).toFixed(2)}%`
      }
      rafRef.current = requestAnimationFrame(drive)
    }
    rafRef.current = requestAnimationFrame(drive)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.clearTimeout(feedbackTimer.current)
      engine.dispose()
      engineRef.current = null
    }
  }, [race, attempt])

  const startRace = () => {
    engineRef.current?.start()
    setPhase('racing')
  }

  const raceAgain = () => {
    setRace(useProgressStore.getState().swimRace)
    setAttempt((a) => a + 1)
    setOutcome(null)
    setPhase('ready')
  }

  return (
    <div ref={containerRef} className="absolute inset-0 z-[55] overflow-hidden bg-sky-bright">
      <canvas ref={canvasRef} className="block size-full touch-none" aria-label="Swim race pool" />

      {/* header */}
      <header className="pt-safe px-safe absolute inset-x-0 top-0 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Back to Rome"
          onPointerUp={onExit}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-night-navy/60 text-xl text-white backdrop-blur-md active:scale-90"
        >
          ◀
        </button>
        <span className="rounded-full bg-night-navy/60 px-4 py-1.5 font-display text-lg font-bold text-adventure-gold backdrop-blur-md">
          🏊 Aqueduct Sprint #{race}
        </span>
        <span className="size-12" aria-hidden="true" />
      </header>

      {/* tap feedback floater */}
      {feedback && phase === 'racing' && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
          <span
            className={[
              'animate-pop-in font-display text-4xl font-bold drop-shadow-lg',
              feedback === 'perfect'
                ? 'text-adventure-gold'
                : feedback === 'good'
                  ? 'text-emerald-jungle'
                  : 'text-soft-cream/80',
            ].join(' ')}
          >
            {feedback === 'perfect' ? 'PERFECT! ⚡' : feedback === 'good' ? 'Nice! 💨' : 'Splash…'}
          </span>
        </div>
      )}

      {/* rhythm meter + TAP button */}
      <div className="pb-safe px-safe absolute inset-x-0 bottom-0 flex flex-col items-center gap-3">
        <div className="relative h-10 w-full max-w-md overflow-hidden rounded-full bg-night-navy/60 backdrop-blur-md">
          <div
            ref={greenRef}
            className="absolute inset-y-0 rounded-full bg-emerald-jungle/80"
            style={{ left: '38%', width: '24%' }}
          />
          <div
            ref={markerRef}
            className="absolute top-0 h-full w-2.5 -translate-x-1/2 rounded-full bg-soft-cream shadow-[0_0_10px_rgba(255,251,235,0.9)]"
            style={{ left: '0%' }}
          />
        </div>
        <button
          type="button"
          aria-label="Swim stroke"
          disabled={phase !== 'racing'}
          onPointerDown={() => engineRef.current?.tap()}
          className="mb-2 flex h-24 w-full max-w-md items-center justify-center rounded-3xl bg-ruby-coral font-display text-3xl font-bold text-white shadow-[0_6px_0_var(--color-ruby-coral-edge)] select-none active:translate-y-1.5 active:shadow-none disabled:opacity-40"
        >
          TAP in the GREEN! 🏊
        </button>
      </div>

      {/* ready overlay */}
      {phase === 'ready' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-night-navy/60 backdrop-blur-sm">
          <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-night-navy">🏊 Swim Race #{race}</h2>
            <p className="py-2 text-lg font-bold text-night-navy/70">
              Tap when the glowing marker is inside the <span className="text-emerald-jungle">green zone</span> to
              swim fast. Bullseye taps = ⚡ PERFECT speed!
            </p>
            <p className="pb-3 text-base font-bold text-night-navy/60">
              🥇 1st · 🥈 2nd · 🥉 3rd — win with all perfects for 💎!
            </p>
            <Button3D color="coral" size="xl" block onTap={startRace} ariaLabel="Start race">
              ON YOUR MARK… GO! 🌊
            </Button3D>
          </div>
        </div>
      )}

      {/* finish overlay */}
      {phase === 'done' && outcome && (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-night-navy/75 backdrop-blur-sm">
          {outcome.medal &&
            Array.from({ length: 18 }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="confetti-piece text-2xl"
                style={{
                  left: `${(i * 137) % 100}%`,
                  animationDuration: `${2.2 + (i % 5) * 0.4}s`,
                  animationDelay: `${(i % 7) * 0.18}s`,
                }}
              >
                {['🎉', '💦', '🎊', '✨', '🥇', '🌊'][i % 6]}
              </span>
            ))}
          <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-night-navy">
              {PLACE_LABEL[outcome.result.placement]}
            </h2>
            {outcome.medal ? (
              <div className="my-3 rounded-2xl bg-adventure-gold/15 p-4">
                <p className="animate-wiggle text-6xl">{MEDAL_EMOJI[outcome.medal]}</p>
                <p className="pt-1 font-display text-xl font-bold text-adventure-gold">
                  {outcome.medal === 'diamond' ? 'DIAMOND MEDAL!' : `${outcome.medal} medal earned!`}
                </p>
              </div>
            ) : (
              <p className="py-2 text-lg font-bold text-night-navy/60">
                So close! Medals go to the top 3 — you've got this. 💪
              </p>
            )}
            <p className="pb-1 font-display text-2xl font-bold text-adventure-gold">
              🪙 +{outcome.coins} coins
            </p>
            <p className="pb-2 text-base font-bold text-night-navy/60">
              ⚡ ×{outcome.result.perfects} perfect · 💨 ×{outcome.result.goods} good ·{' '}
              {(outcome.result.timeMs / 1000).toFixed(1)}s
            </p>
            <div className="flex flex-col gap-3 pt-1">
              <Button3D color="coral" size="lg" block onTap={raceAgain} ariaLabel="Race again">
                {outcome.medal ? 'Next Race ▶' : 'Race Again 💪'}
              </Button3D>
              <Button3D color="cream" size="md" block onTap={onExit} ariaLabel="Back to Rome">
                Back to Rome
              </Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
