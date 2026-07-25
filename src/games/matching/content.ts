/**
 * Matching Builder content + level scaling.
 *
 * Two pair types:
 *  - 'picture' pairs: two identical cards (landmarks, Roman life, animals)
 *  - vocab pairs: one card shows the ITALIAN word, its twin shows ENGLISH —
 *    both share the same emoji, so younger players can match visually while
 *    older players pick up real vocabulary. Sneaky learning by design.
 *
 * Every entry uses a UNIQUE emoji across the whole pool — the emoji is the
 * match cue, so duplicates would create impossible boards.
 */

export interface PicturePairDef {
  key: string
  emoji: string
  label: string
}

export interface VocabPairDef {
  key: string
  emoji: string
  it: string
  en: string
}

export const PICTURE_PAIRS: PicturePairDef[] = [
  { key: 'colosseum', emoji: '🏛️', label: 'Colosseum' },
  { key: 'fountain', emoji: '⛲', label: 'Trevi Fountain' },
  { key: 'pizza', emoji: '🍕', label: 'Pizza' },
  { key: 'gelato', emoji: '🍨', label: 'Gelato' },
  { key: 'vespa', emoji: '🛵', label: 'Vespa' },
  { key: 'vase', emoji: '🏺', label: 'Roman Vase' },
  { key: 'eagle', emoji: '🦅', label: 'Eagle' },
  { key: 'wolf', emoji: '🐺', label: 'She-Wolf' },
  { key: 'volcano', emoji: '🌋', label: 'Volcano' },
  { key: 'stadium', emoji: '🏟️', label: 'Circus Maximus' },
  { key: 'gladiator', emoji: '⚔️', label: 'Gladiator' },
  { key: 'masks', emoji: '🎭', label: 'Theater Masks' },
  { key: 'lion', emoji: '🦁', label: 'Lion' },
  { key: 'monkey', emoji: '🐒', label: 'Monkey' },
  { key: 'parrot', emoji: '🦜', label: 'Parrot' },
  { key: 'vine', emoji: '🌿', label: 'Jungle Vine' },
]

export const VOCAB_PAIRS: VocabPairDef[] = [
  { key: 'ciao', emoji: '👋', it: 'Ciao', en: 'Hello' },
  { key: 'cane', emoji: '🐕', it: 'Cane', en: 'Dog' },
  { key: 'gatto', emoji: '🐱', it: 'Gatto', en: 'Cat' },
  { key: 'sole', emoji: '☀️', it: 'Sole', en: 'Sun' },
  { key: 'luna', emoji: '🌙', it: 'Luna', en: 'Moon' },
  { key: 'acqua', emoji: '💧', it: 'Acqua', en: 'Water' },
  { key: 'casa', emoji: '🏠', it: 'Casa', en: 'House' },
  { key: 'libro', emoji: '📚', it: 'Libro', en: 'Book' },
  { key: 'albero', emoji: '🌳', it: 'Albero', en: 'Tree' },
  { key: 'mela', emoji: '🍎', it: 'Mela', en: 'Apple' },
  { key: 'fiore', emoji: '🌸', it: 'Fiore', en: 'Flower' },
  { key: 'stella', emoji: '⭐', it: 'Stella', en: 'Star' },
]

/* -- Level scaling: 2x2 up to an endless 6x7 ------------------------------ */

export interface LevelConfig {
  level: number
  cols: number
  rows: number
  pairs: number
  /** How long all cards stay face-up at round start ("memorize!") */
  peekMs: number
  /** Fraction of vocab pairs mixed into the board */
  vocabRatio: number
}

/** Every grid has an even card count and keeps cards ≥ ~53px on a 390px
 *  phone (48px tap-target rule) while never overflowing portrait height. */
const GRIDS: Array<[cols: number, rows: number]> = [
  [2, 2], // level 1  →  4 cards
  [2, 3], // level 2  →  6
  [3, 4], // level 3  → 12
  [4, 4], // level 4  → 16
  [4, 5], // level 5  → 20
  [5, 6], // level 6  → 30
  [6, 6], // level 7  → 36
  [6, 7], // level 8+ → 42 — "Endless": grid caps, memory time shrinks
]

export function getLevelConfig(level: number): LevelConfig {
  const [cols, rows] = GRIDS[Math.min(level - 1, GRIDS.length - 1)]
  const peekMs = level <= 2 ? 2200 : level <= 5 ? 1400 : level <= 8 ? 900 : 0
  const vocabRatio = level <= 2 ? 0 : level <= 4 ? 0.3 : 0.45
  return { level, cols, rows, pairs: (cols * rows) / 2, peekMs, vocabRatio }
}

/* -- Deck building --------------------------------------------------------- */

export type CardKind = 'picture' | 'word_it' | 'word_en'

export interface CardDef {
  id: number
  pairId: string
  kind: CardKind
  emoji: string
  label: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildDeck(config: LevelConfig): CardDef[] {
  const vocabCount = Math.min(Math.round(config.pairs * config.vocabRatio), VOCAB_PAIRS.length)
  const pictureCount = config.pairs - vocabCount

  // Pool sizes (16 + 12 = 28) exceed the max 21 pairs — but guard anyway
  // so a future grid change can never silently build a broken board.
  if (pictureCount > PICTURE_PAIRS.length) {
    throw new Error(
      `Matching Builder: level ${config.level} needs ${pictureCount} picture pairs, pool has ${PICTURE_PAIRS.length}`,
    )
  }

  const pictures = shuffle(PICTURE_PAIRS).slice(0, pictureCount)
  const vocab = shuffle(VOCAB_PAIRS).slice(0, vocabCount)

  const cards: Omit<CardDef, 'id'>[] = []
  for (const p of pictures) {
    cards.push({ pairId: p.key, kind: 'picture', emoji: p.emoji, label: p.label })
    cards.push({ pairId: p.key, kind: 'picture', emoji: p.emoji, label: p.label })
  }
  for (const v of vocab) {
    cards.push({ pairId: v.key, kind: 'word_it', emoji: v.emoji, label: v.it })
    cards.push({ pairId: v.key, kind: 'word_en', emoji: v.emoji, label: v.en })
  }

  return shuffle(cards).map((c, i) => ({ ...c, id: i }))
}

/* -- Star rating + coin payout (kid-gentle: 1 star minimum, always win) ---- */

export function starsForRound(pairs: number, moves: number): 1 | 2 | 3 {
  if (moves <= Math.ceil(pairs * 1.4)) return 3
  if (moves <= Math.ceil(pairs * 2.0)) return 2
  return 1
}

export function coinsForRound(pairs: number, stars: number): number {
  return pairs * 2 + stars * 3
}
