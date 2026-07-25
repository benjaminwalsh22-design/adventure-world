import { useEffect, useRef, useState } from 'react'
import type { CardDef } from './content'
import { coinsForRound, getLevelConfig, starsForRound } from './content'
import { useMatchingGame } from './useMatchingGame'
import { Button3D } from '../../components/ui/Button3D'
import type { RewardBannerData } from '../../components/ui/RewardBanner'
import { useProgressStore } from '../../state/useProgressStore'
import { useRewardsStore } from '../../state/useRewardsStore'
import { nextJungleSticker } from '../../prize/stickerArt'
import type { StickerArt } from '../../prize/stickerArt'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

export interface GameScreenProps {
  onExit: () => void
  onReward: (banner: RewardBannerData) => void
}

const STREAK_TARGET = 3

/* -- Card ------------------------------------------------------------------ */

function MatchCard({
  card,
  up,
  matchedNow,
  showLabel,
  onFlip,
}: {
  card: CardDef
  up: boolean
  matchedNow: boolean
  showLabel: boolean
  onFlip: (id: number) => void
}) {
  return (
    <div className="card-persp aspect-square">
      <button
        type="button"
        data-pair={card.pairId}
        data-state={matchedNow ? 'matched' : up ? 'up' : 'down'}
        aria-label={up || matchedNow ? card.label : 'Hidden card'}
        onPointerUp={() => onFlip(card.id)}
        className={[
          'card3d block rounded-2xl text-left',
          up && !matchedNow ? 'is-flipped' : '',
          matchedNow ? 'is-matched' : '',
        ].join(' ')}
      >
        {/* Back (face-down side) */}
        <span className="card-face flex items-center justify-center rounded-2xl bg-sky-bright shadow-[0_4px_0_var(--color-sky-bright-edge)]">
          <span className="font-display text-2xl font-bold text-white/80" aria-hidden="true">
            ?
          </span>
        </span>
        {/* Front (revealed side) */}
        <span
          className={[
            'card-face card-face-front flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1',
            matchedNow
              ? 'bg-emerald-jungle/25 shadow-[inset_0_0_0_3px_var(--color-emerald-jungle)]'
              : 'bg-soft-cream shadow-[0_4px_0_var(--color-soft-cream-edge)]',
          ].join(' ')}
        >
          <span className={showLabel ? 'text-3xl' : 'text-4xl'} aria-hidden="true">
            {card.emoji}
          </span>
          {showLabel && (
            <span
              className={[
                'max-w-full truncate font-display text-base leading-tight font-semibold',
                card.kind === 'word_it' ? 'text-ruby-coral' : 'text-night-navy',
              ].join(' ')}
            >
              {card.label}
              {card.kind === 'word_it' && ' 🇮🇹'}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}

/* -- Win overlay ------------------------------------------------------------ */

interface RoundResult {
  stars: 1 | 2 | 3
  coins: number
  /** Streak pips to display (STREAK_TARGET when a sticker was just earned) */
  displayStreak: number
  sticker: StickerArt | null
}

const CONFETTI = ['🎉', '⭐', '🎊', '✨', '🌟', '🎈']

function WinOverlay({
  level,
  result,
  onNext,
  onHome,
}: {
  level: number
  result: RoundResult
  onNext: () => void
  onHome: () => void
}) {
  const winsToGo = STREAK_TARGET - result.displayStreak
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-night-navy/75 backdrop-blur-sm">
      {/* Confetti rain (deterministic spread) */}
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
          {CONFETTI[i % CONFETTI.length]}
        </span>
      ))}

      <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
        <h2 className="font-display text-3xl font-bold text-night-navy">Level {level} done!</h2>

        <div className="py-3 text-4xl" role="img" aria-label={`${result.stars} out of 3 stars`}>
          {'⭐'.repeat(result.stars)}
          <span className="opacity-20" aria-hidden="true">
            {'⭐'.repeat(3 - result.stars)}
          </span>
        </div>

        <p className="pb-1 font-display text-2xl font-bold text-adventure-gold">
          🪙 +{result.coins} coins
        </p>

        {result.sticker ? (
          <div className="my-3 rounded-2xl bg-emerald-jungle/15 p-4">
            <p className="animate-wiggle text-5xl">{result.sticker.emoji}</p>
            <p className="pt-1 font-display text-xl font-bold text-emerald-jungle">
              New Jungle Sticker!
            </p>
            <p className="text-base font-bold text-night-navy/60">{result.sticker.name}</p>
          </div>
        ) : (
          <p className="pb-2 text-base font-bold text-night-navy/60">
            {winsToGo} more {winsToGo === 1 ? 'win' : 'wins'} in a row for a Jungle Sticker! 🦜
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button3D color="emerald" size="lg" block onTap={onNext} ariaLabel="Next level">
            Next Level ▶
          </Button3D>
          <Button3D color="cream" size="md" block onTap={onHome} ariaLabel="Back to Rome">
            Back to Rome
          </Button3D>
        </div>
      </div>
    </div>
  )
}

/* -- Round (one level) ----------------------------------------------------- */

function Round({
  level,
  onRoundWon,
  onNextLevel,
  onLeave,
}: {
  level: number
  onRoundWon: (moves: number) => RoundResult
  onNextLevel: () => void
  onLeave: (midRound: boolean) => void
}) {
  const { config, cards, phase, faceUp, matched, moves, flip } = useMatchingGame(level)
  const [result, setResult] = useState<RoundResult | null>(null)
  const scoredRef = useRef(false)
  const storeStreak = useProgressStore((s) => s.matchingStreak)

  /* Score exactly once when the round is won */
  useEffect(() => {
    if (phase === 'won' && !scoredRef.current) {
      scoredRef.current = true
      setResult(onRoundWon(moves))
    }
  }, [phase, moves, onRoundWon])

  const streakPips = result ? result.displayStreak : storeStreak

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <header className="pt-safe px-safe flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Back to Rome"
          onPointerUp={() => onLeave(phase !== 'won')}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-night-navy/60 text-xl text-white backdrop-blur-md active:scale-90"
        >
          ◀
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-night-navy/60 px-4 py-1.5 font-display text-lg font-bold text-adventure-gold backdrop-blur-md">
            Level {level}
          </span>
          <span className="rounded-full bg-night-navy/60 px-4 py-1.5 font-display text-lg font-bold text-soft-cream backdrop-blur-md">
            {moves} moves
          </span>
        </div>
        {/* Streak pips → sticker at 3 */}
        <div
          className="flex shrink-0 items-center gap-1 rounded-full bg-night-navy/60 px-3 py-2 backdrop-blur-md"
          aria-label={`${streakPips} of ${STREAK_TARGET} wins toward a sticker`}
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
            🦜
          </span>
        </div>
      </header>

      {/* Phase hint */}
      <p
        className={[
          'py-2 text-center font-display text-xl font-bold',
          phase === 'peek' ? 'animate-wiggle text-adventure-gold' : 'text-soft-cream/50',
        ].join(' ')}
      >
        {phase === 'peek' ? '👀 Memorize the cards!' : 'Find the matching pairs!'}
      </p>

      {/* Board */}
      <div className="px-safe flex flex-1 items-center justify-center pt-1 pb-6">
        <div
          className={['grid w-full gap-2', config.cols <= 3 ? 'max-w-xs' : 'max-w-md'].join(' ')}
          style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
        >
          {cards.map((card) => (
            <MatchCard
              key={card.id}
              card={card}
              up={phase === 'peek' || faceUp.includes(card.id)}
              matchedNow={matched.has(card.pairId)}
              showLabel={config.cols <= 4}
              onFlip={flip}
            />
          ))}
        </div>
      </div>

      {/* Win overlay */}
      {phase === 'won' && result && (
        <WinOverlay
          level={level}
          result={result}
          onNext={onNextLevel}
          onHome={() => onLeave(false)}
        />
      )}
    </div>
  )
}

/* -- Game screen (owns level / streak / reward flow) ------------------------ */

export default function MatchingBuilder({ onExit, onReward }: GameScreenProps) {
  const [level, setLevel] = useState(() => useProgressStore.getState().matchingLevel)
  const [roundKey, setRoundKey] = useState(0)

  const handleRoundWon = (moves: number): RoundResult => {
    const progress = useProgressStore.getState()
    const rewards = useRewardsStore.getState()
    const pairs = getLevelConfig(level).pairs

    const stars = starsForRound(pairs, moves)
    const coins = coinsForRound(pairs, stars)
    rewards.addCoins(coins)

    const streakNow = progress.matchingStreak + 1
    let sticker: StickerArt | null = null

    if (streakNow >= STREAK_TARGET) {
      sticker = nextJungleSticker(rewards.stickers.length)
      rewards.awardSticker({
        stickerKey: sticker.stickerKey,
        name: sticker.name,
        animated: sticker.animated,
      })
      onReward({
        emoji: sticker.emoji,
        headline: 'You won a Jungle Sticker!',
        sub: `${sticker.name} joined your Sticker Book`,
      })
    } else {
      playSfx('reward')
      haptic('success')
    }

    // Streak banks to 0 after paying out a sticker; level always climbs.
    progress.advanceMatching({ streakAfterRound: sticker ? 0 : streakNow })

    return {
      stars,
      coins,
      displayStreak: sticker ? STREAK_TARGET : streakNow,
      sticker,
    }
  }

  const handleNextLevel = () => {
    setLevel(useProgressStore.getState().matchingLevel)
    setRoundKey((k) => k + 1) // remounts Round → fresh deck + peek phase
  }

  const handleLeave = (midRound: boolean) => {
    if (midRound) {
      // Quitting mid-round breaks the "consecutive" chain — by design.
      useProgressStore.getState().resetMatchingStreak()
    }
    onExit()
  }

  return (
    <div className="absolute inset-0 z-[55] bg-gradient-to-b from-[#312e81] via-night-navy to-[#312e81]">
      <Round
        key={roundKey}
        level={level}
        onRoundWon={handleRoundWon}
        onNextLevel={handleNextLevel}
        onLeave={handleLeave}
      />
    </div>
  )
}
