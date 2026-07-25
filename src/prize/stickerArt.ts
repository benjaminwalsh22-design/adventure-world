/**
 * Sticker catalog — the pool Jungle Stickers are drawn from, and the art
 * lookup the Prize Room uses to render an earned sticker by its key.
 * (Emoji art in v1; swapped for animated Lottie/sprite art later without
 * touching the reward data model — stickerKey stays stable.)
 */

export interface StickerArt {
  stickerKey: string
  emoji: string
  name: string
  animated: boolean
}

export const JUNGLE_STICKER_POOL: StickerArt[] = [
  { stickerKey: 'jungle/parrot', emoji: '🦜', name: 'Rio the Rainbow Parrot', animated: false },
  { stickerKey: 'jungle/monkey', emoji: '🐒', name: 'Momo the Cheeky Monkey', animated: false },
  { stickerKey: 'jungle/lion', emoji: '🦁', name: 'Leo the Brave Lion', animated: false },
  { stickerKey: 'jungle/butterfly', emoji: '🦋', name: 'Bella the Jewel Butterfly', animated: false },
  { stickerKey: 'jungle/snake', emoji: '🐍', name: 'Sami the Silly Snake', animated: false },
  { stickerKey: 'jungle/turtle', emoji: '🐢', name: 'Turbo the Turtle', animated: false },
  { stickerKey: 'jungle/flamingo', emoji: '🦩', name: 'Fifi the Fancy Flamingo', animated: false },
  { stickerKey: 'jungle/elephant', emoji: '🐘', name: 'Ellie the Big Elephant', animated: false },
]

const ART_BY_KEY = new Map(JUNGLE_STICKER_POOL.map((s) => [s.stickerKey, s]))

export function stickerEmoji(stickerKey: string): string {
  return ART_BY_KEY.get(stickerKey)?.emoji ?? '🦜'
}

/** Deterministic next sticker: walk the pool in order, cycling when a
 *  collector has earned them all (dupes only after a full set). */
export function nextJungleSticker(ownedCount: number): StickerArt {
  return JUNGLE_STICKER_POOL[ownedCount % JUNGLE_STICKER_POOL.length]
}
