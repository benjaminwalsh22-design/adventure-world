import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CardDef, LevelConfig } from './content'
import { buildDeck, getLevelConfig } from './content'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

export type RoundPhase = 'peek' | 'play' | 'won'

export interface MatchingGameState {
  config: LevelConfig
  cards: CardDef[]
  phase: RoundPhase
  /** Card ids currently face-up mid-guess (0, 1, or 2 entries) */
  faceUp: number[]
  /** pairIds already matched */
  matched: ReadonlySet<string>
  moves: number
  flip: (cardId: number) => void
}

const MATCH_HOLD_MS = 420 // both cards visible before locking in a match
const MISMATCH_HOLD_MS = 950 // kids need a beat to memorize before flip-back

/**
 * Round engine for Matching Builder. One hook instance = one round; the
 * parent remounts it (via key={level}) to start the next round.
 *
 * All timers are tracked and cleared on unmount, so quitting mid-animation
 * can never fire a state update on a dead component.
 */
export function useMatchingGame(level: number): MatchingGameState {
  const config = useMemo(() => getLevelConfig(level), [level])
  const [cards] = useState<CardDef[]>(() => buildDeck(config))
  const [phase, setPhase] = useState<RoundPhase>(config.peekMs > 0 ? 'peek' : 'play')
  const [faceUp, setFaceUp] = useState<number[]>([])
  const [matched, setMatched] = useState<ReadonlySet<string>>(new Set())
  const [moves, setMoves] = useState(0)

  const timers = useRef<number[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])

  /* Memorize-phase countdown */
  useEffect(() => {
    if (config.peekMs > 0) {
      later(() => setPhase((p) => (p === 'peek' ? 'play' : p)), config.peekMs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flip = useCallback(
    (cardId: number) => {
      if (phase !== 'play') return
      if (faceUp.length >= 2) return // board locked during compare
      if (faceUp.includes(cardId)) return // no double-tapping the same card
      const card = cards.find((c) => c.id === cardId)
      if (!card || matched.has(card.pairId)) return

      haptic('tap')
      playSfx('pop')

      const next = [...faceUp, cardId]
      setFaceUp(next)
      if (next.length < 2) return

      setMoves((m) => m + 1)
      const [a, b] = next.map((id) => cards.find((c) => c.id === id)!)

      if (a.pairId === b.pairId) {
        later(() => {
          playSfx('success')
          haptic('success')
          setFaceUp([])
          setMatched((prev) => {
            const nextMatched = new Set(prev)
            nextMatched.add(a.pairId)
            if (nextMatched.size === config.pairs) {
              setPhase('won')
            }
            return nextMatched
          })
        }, MATCH_HOLD_MS)
      } else {
        later(() => {
          playSfx('error')
          setFaceUp([])
        }, MISMATCH_HOLD_MS)
      }
    },
    [phase, faceUp, cards, matched, config.pairs, later],
  )

  return { config, cards, phase, faceUp, matched, moves, flip }
}
