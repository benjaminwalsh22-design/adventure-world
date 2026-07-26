import { useEffect, useRef, useState } from 'react'
import { CannonEngine } from './CannonEngine'
import { Button3D } from '../../components/ui/Button3D'
import type { RewardBannerData } from '../../components/ui/RewardBanner'
import { useProgressStore } from '../../state/useProgressStore'
import { useRewardsStore } from '../../state/useRewardsStore'
import { playSfx } from '../../lib/sfx'
import { haptic } from '../../lib/haptics'

interface GameScreenProps {
  onExit: () => void
  onReward: (banner: RewardBannerData) => void
}

interface Outcome {
  cleared: boolean
  coins: number
  remaining?: number
}

export default function TargetCannon({ onExit, onReward }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CannonEngine | null>(null)
  const shotsRef = useRef<HTMLSpanElement>(null)
  const targetsRef = useRef<HTMLSpanElement>(null)

  const [level, setLevel] = useState(() => useProgressStore.getState().cannonLevel)
  const [attempt, setAttempt] = useState(1)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [angle, setAngle] = useState(45)
  const [power, setPower] = useState(65)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const engine = new CannonEngine(container, canvas, level, {
      onHudChange: (shots, targets) => {
        if (shotsRef.current) shotsRef.current.textContent = String(shots)
        if (targetsRef.current) targetsRef.current.textContent = String(targets)
      },
      onCleared: (shotsLeft, popped) => {
        const coins = popped * 3 + shotsLeft * 5 + Math.min(level * 2, 20)
        useRewardsStore.getState().addCoins(coins)
        useProgressStore.getState().advanceCannon()
        if (shotsLeft >= 3) {
          onReward({
            emoji: '🎯',
            headline: 'Sharpshooter!',
            sub: `Cleared with ${shotsLeft} shots to spare`,
          })
        }
        setOutcome({ cleared: true, coins })
      },
      onOutOfShots: (remaining) => {
        playSfx('error')
        setOutcome({ cleared: false, coins: 0, remaining })
      },
    })
    engine.setAngle(angle)
    engine.setPower(power)
    engineRef.current = engine
    ;(window as unknown as { __awCannon?: CannonEngine }).__awCannon = engine

    return () => {
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, attempt])

  return (
    <div ref={containerRef} className="absolute inset-0 z-[55] overflow-hidden bg-[#818cf8]">
      <canvas ref={canvasRef} className="block size-full touch-none" aria-label="Cannon target range" />

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
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-night-navy/60 px-3 py-1.5 font-display text-base font-bold whitespace-nowrap text-adventure-gold backdrop-blur-md">
            🎪 Level {level}
          </span>
          <span className="rounded-full bg-night-navy/60 px-3 py-1.5 font-display text-base font-bold whitespace-nowrap text-soft-cream backdrop-blur-md">
            🎈 <span ref={targetsRef}>0</span>
          </span>
          <span className="rounded-full bg-night-navy/60 px-3 py-1.5 font-display text-base font-bold whitespace-nowrap text-soft-cream backdrop-blur-md">
            ⚫ <span ref={shotsRef}>0</span>
          </span>
        </div>
        <span className="size-12" aria-hidden="true" />
      </header>

      {/* aim controls */}
      <div className="pb-safe px-safe absolute inset-x-0 bottom-0 flex flex-col gap-2">
        <div className="mx-auto w-full max-w-md rounded-3xl bg-night-navy/60 p-4 backdrop-blur-md">
          <label className="flex items-center gap-3 pb-3">
            <span className="w-20 shrink-0 font-display text-base font-bold text-soft-cream">
              📐 Angle
            </span>
            <input
              type="range"
              min={15}
              max={80}
              value={angle}
              aria-label="Cannon angle"
              onChange={(e) => {
                const v = Number(e.target.value)
                setAngle(v)
                engineRef.current?.setAngle(v)
              }}
              className="h-3 flex-1 accent-adventure-gold"
              style={{ touchAction: 'none' }}
            />
            <span className="w-12 text-right font-display text-base font-bold text-adventure-gold">
              {angle}°
            </span>
          </label>
          <label className="flex items-center gap-3 pb-4">
            <span className="w-20 shrink-0 font-display text-base font-bold text-soft-cream">
              💪 Power
            </span>
            <input
              type="range"
              min={20}
              max={100}
              value={power}
              aria-label="Cannon power"
              onChange={(e) => {
                const v = Number(e.target.value)
                setPower(v)
                engineRef.current?.setPower(v)
              }}
              className="h-3 flex-1 accent-ruby-coral"
              style={{ touchAction: 'none' }}
            />
            <span className="w-12 text-right font-display text-base font-bold text-ruby-coral">
              {power}
            </span>
          </label>
          <Button3D
            color="gold"
            size="xl"
            block
            onTap={() => engineRef.current?.fire()}
            ariaLabel="Fire the cannon"
          >
            FIRE! 🎉
          </Button3D>
        </div>
      </div>

      {/* outcome overlay */}
      {outcome && (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-night-navy/75 backdrop-blur-sm">
          {outcome.cleared &&
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
                {['🎉', '🎈', '🎊', '✨', '🎯', '🎪'][i % 6]}
              </span>
            ))}
          <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
            {outcome.cleared ? (
              <>
                <h2 className="font-display text-3xl font-bold text-night-navy">
                  All targets down! 🎯
                </h2>
                <p className="py-2 font-display text-2xl font-bold text-adventure-gold">
                  🪙 +{outcome.coins} coins
                </p>
                <div className="flex flex-col gap-3 pt-2">
                  <Button3D
                    color="gold"
                    size="lg"
                    block
                    onTap={() => {
                      haptic('tap')
                      setLevel(useProgressStore.getState().cannonLevel)
                      setAttempt((a) => a + 1)
                      setOutcome(null)
                    }}
                    ariaLabel="Next level"
                  >
                    Next Level ▶
                  </Button3D>
                  <Button3D color="cream" size="md" block onTap={onExit} ariaLabel="Back to Rome">
                    Back to Rome
                  </Button3D>
                </div>
              </>
            ) : (
              <>
                <p className="text-5xl">🎈</p>
                <h2 className="pt-1 font-display text-3xl font-bold text-night-navy">
                  {outcome.remaining} {outcome.remaining === 1 ? 'balloon' : 'targets'} got away!
                </h2>
                <p className="py-2 text-lg font-bold text-night-navy/70">
                  Watch the dotted arc — line it up and try again!
                </p>
                <div className="flex flex-col gap-3 pt-2">
                  <Button3D
                    color="sky"
                    size="lg"
                    block
                    onTap={() => {
                      setAttempt((a) => a + 1)
                      setOutcome(null)
                    }}
                    ariaLabel="Try again"
                  >
                    Try Again 💪
                  </Button3D>
                  <Button3D color="cream" size="md" block onTap={onExit} ariaLabel="Back to Rome">
                    Back to Rome
                  </Button3D>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
