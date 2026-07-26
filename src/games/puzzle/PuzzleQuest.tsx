import { useEffect, useRef, useState } from 'react'
import { PuzzleEngine } from './PuzzleEngine'
import { SCENES } from './puzzleArt'
import type { SceneKey } from './puzzleArt'
import { Button3D } from '../../components/ui/Button3D'
import type { RewardBannerData } from '../../components/ui/RewardBanner'
import { useRewardsStore } from '../../state/useRewardsStore'
import { playSfx } from '../../lib/sfx'
import { haptic } from '../../lib/haptics'

interface GameScreenProps {
  onExit: () => void
  onReward: (banner: RewardBannerData) => void
}

interface Preset {
  pieces: number
  cols: number
  rows: number
  label: string
  emoji: string
  coins: number
  ghost: boolean
  snapFactor: number
}

const PRESETS: Preset[] = [
  { pieces: 12, cols: 4, rows: 3, label: 'Easy Explorer', emoji: '🐣', coins: 10, ghost: true, snapFactor: 0.5 },
  { pieces: 48, cols: 8, rows: 6, label: 'Puzzle Pro', emoji: '🧭', coins: 30, ghost: true, snapFactor: 0.5 },
  { pieces: 100, cols: 10, rows: 10, label: 'Champion', emoji: '🏆', coins: 70, ghost: true, snapFactor: 0.55 },
  { pieces: 1000, cols: 40, rows: 25, label: 'MEGA 1000', emoji: '🤯', coins: 500, ghost: true, snapFactor: 1.0 },
]

export default function PuzzleQuest({ onExit, onReward }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<PuzzleEngine | null>(null)
  const placedRef = useRef<HTMLSpanElement>(null)

  const [preset, setPreset] = useState<Preset | null>(null)
  const [scene, setScene] = useState<SceneKey>('colosseum')
  const [done, setDone] = useState(false)

  /* engine per chosen preset */
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || !preset) return

    const engine = new PuzzleEngine(
      container,
      canvas,
      {
        cols: preset.cols,
        rows: preset.rows,
        scene,
        ghost: preset.ghost,
        snapFactor: preset.snapFactor,
      },
      {
        onPlaced: (placed, total) => {
          if (placedRef.current) placedRef.current.textContent = `${placed}/${total}`
        },
        onComplete: () => {
          const rewards = useRewardsStore.getState()
          rewards.addCoins(preset.coins)
          playSfx('reward')
          haptic('reward')
          if (preset.pieces >= 100) {
            onReward({
              emoji: '🧩',
              headline: `${preset.pieces}-piece puzzle SOLVED!`,
              sub: `+${preset.coins} coins — legendary puzzling`,
            })
          }
          setDone(true)
        },
      },
    )
    engineRef.current = engine
    ;(window as unknown as { __awPuzzle?: PuzzleEngine }).__awPuzzle = engine

    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [preset, scene, onReward])

  /* ---- preset chooser ---- */
  if (!preset) {
    return (
      <div className="absolute inset-0 z-[55] bg-gradient-to-b from-[#312e81] via-night-navy to-[#312e81]">
        <header className="pt-safe px-safe flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to Rome"
            onPointerUp={onExit}
            className="flex size-12 items-center justify-center rounded-full bg-night-navy/60 text-xl text-white backdrop-blur-md active:scale-90"
          >
            ◀
          </button>
          <h1 className="font-display text-2xl font-bold text-adventure-gold">🧩 Puzzle Quest</h1>
        </header>

        <div className="px-safe scroll-panel h-full pt-4 pb-32">
          <p className="pb-3 text-center text-lg font-bold text-soft-cream/70">
            Pick your picture…
          </p>
          <div className="mx-auto flex max-w-md justify-center gap-2 pb-5">
            {SCENES.map((s) => (
              <button
                key={s.key}
                type="button"
                onPointerUp={() => {
                  setScene(s.key)
                  playSfx('pop')
                }}
                className={[
                  'min-h-12 flex-1 rounded-2xl px-2 py-2 font-display text-base font-bold transition-all',
                  scene === s.key
                    ? 'bg-adventure-gold text-white shadow-[0_4px_0_var(--color-adventure-gold-edge)]'
                    : 'bg-soft-cream/15 text-soft-cream/80',
                ].join(' ')}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>

          <p className="pb-3 text-center text-lg font-bold text-soft-cream/70">…and your size!</p>
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.pieces}
                type="button"
                onPointerUp={() => {
                  haptic('tap')
                  playSfx('pop')
                  setPreset(p)
                }}
                className="flex min-h-28 flex-col items-center justify-center rounded-3xl bg-soft-cream p-3 shadow-[0_5px_0_var(--color-soft-cream-edge)] active:translate-y-1"
              >
                <span className="text-4xl">{p.emoji}</span>
                <span className="font-display text-xl font-bold text-night-navy">{p.pieces} pieces</span>
                <span className="text-base font-bold text-night-navy/60">{p.label} · 🪙 {p.coins}</span>
              </button>
            ))}
          </div>
          <p className="mx-auto max-w-md pt-4 text-center text-base font-bold text-soft-cream/50">
            Pinch to zoom · drag pieces onto the glowing board · they snap like magnets! 🧲
          </p>
        </div>
      </div>
    )
  }

  /* ---- puzzle board ---- */
  return (
    <div ref={containerRef} className="absolute inset-0 z-[55] overflow-hidden bg-night-navy">
      <canvas ref={canvasRef} className="block size-full touch-none" aria-label="Jigsaw puzzle board" />

      <header className="pt-safe px-safe absolute inset-x-0 top-0 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Back to puzzle sizes"
          onPointerUp={() => {
            setPreset(null)
            setDone(false)
          }}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-night-navy/60 text-xl text-white backdrop-blur-md active:scale-90"
        >
          ◀
        </button>
        <span className="rounded-full bg-night-navy/60 px-4 py-1.5 font-display text-lg font-bold text-adventure-gold backdrop-blur-md">
          🧩 <span ref={placedRef}>0/{preset.pieces}</span>
        </span>
        <button
          type="button"
          aria-label="Reset zoom"
          onPointerUp={() => engineRef.current?.resetView()}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-night-navy/60 text-xl backdrop-blur-md active:scale-90"
        >
          🔍
        </button>
      </header>

      {done && (
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
              {['🎉', '🧩', '🎊', '✨', '🌟', '🏆'][i % 6]}
            </span>
          ))}
          <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-night-navy">Puzzle complete! 🧩</h2>
            <p className="py-2 font-display text-2xl font-bold text-adventure-gold">
              🪙 +{preset.coins} coins
            </p>
            <p className="pb-3 text-base font-bold text-night-navy/60">
              {preset.pieces} pieces — amazing work!
            </p>
            <div className="flex flex-col gap-3">
              <Button3D
                color="gold"
                size="lg"
                block
                onTap={() => {
                  setPreset(null)
                  setDone(false)
                }}
                ariaLabel="Another puzzle"
              >
                Another Puzzle ▶
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
