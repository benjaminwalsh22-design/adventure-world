import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunResult } from './DashEngine'
import { DashEngine, getRunConfig } from './DashEngine'
import type { DashTheme } from './themes'
import { Button3D } from '../../components/ui/Button3D'
import type { RewardBannerData } from '../../components/ui/RewardBanner'
import { useProgressStore } from '../../state/useProgressStore'
import { useRewardsStore } from '../../state/useRewardsStore'
import { nextStickerFromPool } from '../../prize/stickerArt'
import type { StickerArt } from '../../prize/stickerArt'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

export interface GameScreenProps {
  onExit: () => void
  onReward: (banner: RewardBannerData) => void
}

const STREAK_TARGET = 3

interface RunOutcome {
  result: RunResult
  stars: 1 | 2 | 3
  coins: number
  displayStreak: number
  sticker: StickerArt | null
}

/** Theme-keyed progress accessors — one screen serves every dash world. */
function readProgress(theme: DashTheme): { level: number; streak: number } {
  const s = useProgressStore.getState()
  return theme.key === 'safari'
    ? { level: s.safariLevel, streak: s.safariStreak }
    : { level: s.jungleLevel, streak: s.jungleStreak }
}

function advanceProgress(theme: DashTheme, streakAfterRun: number): void {
  const s = useProgressStore.getState()
  if (theme.key === 'safari') s.advanceSafari({ streakAfterRun })
  else s.advanceJungle({ streakAfterRun })
}

function resetStreak(theme: DashTheme): void {
  const s = useProgressStore.getState()
  if (theme.key === 'safari') s.resetSafariStreak()
  else s.resetJungleStreak()
}

export default function DashGame({
  theme,
  onExit,
  onReward,
}: GameScreenProps & { theme: DashTheme }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<DashEngine | null>(null)
  const progressFillRef = useRef<HTMLDivElement>(null)
  const pawCountRef = useRef<HTMLSpanElement>(null)
  const heartsRef = useRef<HTMLSpanElement>(null)

  const [level, setLevel] = useState(() => readProgress(theme).level)
  const [attempt, setAttempt] = useState(1)
  const [phase, setPhase] = useState<'ready' | 'running' | 'won' | 'failed'>('ready')
  const [outcome, setOutcome] = useState<RunOutcome | null>(null)
  const [failResult, setFailResult] = useState<RunResult | null>(null)
  const storeStreak = useProgressStore((s) =>
    theme.key === 'safari' ? s.safariStreak : s.jungleStreak,
  )

  const handleFinish = useCallback(
    (result: RunResult): void => {
      const rewards = useRewardsStore.getState()

      const stars = Math.max(3 - result.stumbles, 1) as 1 | 2 | 3
      const coins = 10 + result.paws + stars * 3 + Math.min(level, 10)
      rewards.addCoins(coins)

      const streakNow = readProgress(theme).streak + 1
      let sticker: StickerArt | null = null

      if (streakNow >= STREAK_TARGET) {
        sticker = nextStickerFromPool(
          theme.stickerPool,
          rewards.stickers.map((s) => s.stickerKey),
        )
        rewards.awardSticker({
          stickerKey: sticker.stickerKey,
          name: sticker.name,
          animated: sticker.animated,
        })
        onReward({
          emoji: sticker.emoji,
          headline: theme.stickerBannerTitle,
          sub: `${sticker.name} joined your Sticker Book`,
        })
      } else {
        playSfx('reward')
        haptic('success')
      }

      advanceProgress(theme, sticker ? 0 : streakNow)
      setOutcome({
        result,
        stars,
        coins,
        displayStreak: sticker ? STREAK_TARGET : streakNow,
        sticker,
      })
      setPhase('won')
    },
    [level, onReward, theme],
  )

  const handleFail = useCallback((result: RunResult): void => {
    // A tumble never breaks the sticker streak — only leaving mid-run does.
    setFailResult(result)
    setPhase('failed')
  }, [])

  const handleFinishRef = useRef(handleFinish)
  handleFinishRef.current = handleFinish
  const handleFailRef = useRef(handleFail)
  handleFailRef.current = handleFail

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const engine = new DashEngine(container, canvas, getRunConfig(level), attempt, theme, {
      onFinish: (r) => handleFinishRef.current(r),
      onFail: (r) => handleFailRef.current(r),
    })
    engine.setHudRefs({
      progressFill: progressFillRef.current,
      pawCount: pawCountRef.current,
      hearts: heartsRef.current,
    })
    engineRef.current = engine
    ;(window as unknown as { __awDash?: DashEngine }).__awDash = engine

    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [level, attempt, theme])

  const startRun = () => {
    engineRef.current?.start()
    setPhase('running')
  }

  const nextRun = () => {
    setLevel(readProgress(theme).level)
    setAttempt((a) => a + 1)
    setOutcome(null)
    setPhase('ready')
  }

  const retryRun = () => {
    setAttempt((a) => a + 1)
    setFailResult(null)
    setPhase('ready')
  }

  const leave = (midRun: boolean) => {
    if (midRun) resetStreak(theme)
    onExit()
  }

  const streakPips = phase === 'won' && outcome ? outcome.displayStreak : storeStreak

  return (
    <div ref={containerRef} className="absolute inset-0 z-[55] overflow-hidden bg-[#fde68a]">
      <canvas
        ref={canvasRef}
        className="block size-full touch-none"
        aria-label={`${theme.title} run`}
      />

      {/* HUD header */}
      <header className="pt-safe px-safe absolute inset-x-0 top-0 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={`Back to ${theme.cityName}`}
          onPointerUp={() => leave(phase === 'running')}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-night-navy/60 text-xl text-white backdrop-blur-md active:scale-90"
        >
          ◀
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-1">
          <div className="flex items-center justify-center gap-2">
            <span className="rounded-full bg-night-navy/60 px-2.5 py-1 font-display text-base font-bold whitespace-nowrap text-adventure-gold backdrop-blur-md">
              Run {level}
            </span>
            <span
              ref={heartsRef}
              className="rounded-full bg-night-navy/60 px-2.5 py-1 text-sm tracking-tighter whitespace-nowrap backdrop-blur-md"
              aria-label="Stumbles left"
            >
              ❤️❤️❤️
            </span>
            <span className="rounded-full bg-night-navy/60 px-2.5 py-1 font-display text-base font-bold whitespace-nowrap text-soft-cream backdrop-blur-md">
              {theme.pickupEmoji} <span ref={pawCountRef}>0</span>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-night-navy/30">
            <div
              ref={progressFillRef}
              className="h-full rounded-full bg-emerald-jungle transition-none"
              style={{ width: '0%' }}
            />
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded-full bg-night-navy/60 px-3 py-2 backdrop-blur-md"
          aria-label={`${streakPips} of ${STREAK_TARGET} runs toward a sticker`}
        >
          {Array.from({ length: STREAK_TARGET }, (_, i) => (
            <span
              key={i}
              className={[
                'size-3.5 rounded-full',
                i < streakPips ? 'bg-adventure-gold' : 'bg-white/25',
              ].join(' ')}
            />
          ))}
          <span className="pl-0.5 text-base" aria-hidden="true">
            {theme.titleEmoji}
          </span>
        </div>
      </header>

      {/* Big directional touch buttons */}
      {phase === 'running' && (
        <div className="pb-safe px-safe pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4">
          <button
            type="button"
            aria-label="Duck"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              engineRef.current?.duckDown()
            }}
            onPointerUp={() => engineRef.current?.duckUp()}
            onPointerCancel={() => engineRef.current?.duckUp()}
            className="pointer-events-auto mb-2 flex h-24 w-[42%] flex-col items-center justify-center rounded-3xl bg-ruby-coral font-display text-2xl font-bold text-white shadow-[0_6px_0_var(--color-ruby-coral-edge)] select-none active:translate-y-1.5 active:shadow-none"
          >
            <span aria-hidden="true">⬇️</span>
            DUCK
          </button>
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={() => engineRef.current?.jump()}
            className="pointer-events-auto mb-2 flex h-24 w-[42%] flex-col items-center justify-center rounded-3xl bg-sky-bright font-display text-2xl font-bold text-white shadow-[0_6px_0_var(--color-sky-bright-edge)] select-none active:translate-y-1.5 active:shadow-none"
          >
            <span aria-hidden="true">⬆️</span>
            JUMP
          </button>
        </div>
      )}

      {/* Ready overlay */}
      {phase === 'ready' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-night-navy/60 backdrop-blur-sm">
          <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-night-navy">
              {theme.titleEmoji} {theme.title}
            </h2>
            <p className="py-2 text-lg font-bold text-night-navy/70">{theme.introLine}</p>
            <div className="flex justify-center gap-6 py-3 text-lg font-bold text-night-navy">
              <span>
                ⬆️ JUMP over {theme.jumpA} {theme.jumpB}
              </span>
              <span>
                ⬇️ DUCK under {theme.duckFlyer} {theme.duckHangs}
              </span>
            </div>
            <Button3D color="emerald" size="xl" block onTap={startRun} ariaLabel="Start running">
              GO! 🏃
            </Button3D>
          </div>
        </div>
      )}

      {/* Win overlay */}
      {phase === 'won' && outcome && (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-night-navy/75 backdrop-blur-sm">
          {Array.from({ length: 18 }, (_, i) => (
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
              {theme.confetti[i % theme.confetti.length]}
            </span>
          ))}
          <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-night-navy">
              You made it! {theme.finishEmojis[2]}
            </h2>
            <div className="py-3 text-4xl" role="img" aria-label={`${outcome.stars} out of 3 stars`}>
              {'⭐'.repeat(outcome.stars)}
              <span className="opacity-20" aria-hidden="true">
                {'⭐'.repeat(3 - outcome.stars)}
              </span>
            </div>
            <p className="pb-1 font-display text-2xl font-bold text-adventure-gold">
              🪙 +{outcome.coins} coins
            </p>
            <p className="pb-1 text-base font-bold text-night-navy/60">
              {outcome.result.meters}m run · {theme.pickupEmoji} ×{outcome.result.paws}
            </p>
            {outcome.sticker ? (
              <div className="my-3 rounded-2xl bg-emerald-jungle/15 p-4">
                <p className="animate-float text-5xl">{outcome.sticker.emoji}</p>
                <p className="pt-1 font-display text-xl font-bold text-emerald-jungle">
                  {theme.stickerBannerTitle}
                </p>
                <p className="text-base font-bold text-night-navy/60">{outcome.sticker.name}</p>
              </div>
            ) : (
              <p className="pb-2 text-base font-bold text-night-navy/60">
                {STREAK_TARGET - outcome.displayStreak} more{' '}
                {STREAK_TARGET - outcome.displayStreak === 1 ? 'run' : 'runs'} for a sticker!{' '}
                {theme.titleEmoji}
              </p>
            )}
            <div className="flex flex-col gap-3 pt-2">
              <Button3D color="emerald" size="lg" block onTap={nextRun} ariaLabel="Next run">
                Next Run ▶
              </Button3D>
              <Button3D
                color="cream"
                size="md"
                block
                onTap={() => leave(false)}
                ariaLabel={`Back to ${theme.cityName}`}
              >
                Back to {theme.cityName}
              </Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Fail overlay */}
      {phase === 'failed' && failResult && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-night-navy/70 backdrop-blur-sm">
          <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
            <p className="text-5xl">🙈</p>
            <h2 className="pt-1 font-display text-3xl font-bold text-night-navy">
              Whoops — big tumble!
            </h2>
            <p className="py-2 text-lg font-bold text-night-navy/70">
              You ran {failResult.meters}m. {theme.finishName} is close — try again!
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Button3D color="sky" size="lg" block onTap={retryRun} ariaLabel="Try again">
                Try Again 💪
              </Button3D>
              <Button3D
                color="cream"
                size="md"
                block
                onTap={() => leave(false)}
                ariaLabel={`Back to ${theme.cityName}`}
              >
                Back to {theme.cityName}
              </Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
