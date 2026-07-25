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

export const SAFARI_STICKER_POOL: StickerArt[] = [
  { stickerKey: 'safari/giraffe', emoji: '🦒', name: 'Stretch the Giraffe', animated: true },
  { stickerKey: 'safari/zebra', emoji: '🦓', name: 'Zigzag the Zebra', animated: true },
  { stickerKey: 'safari/elephant', emoji: '🐘', name: 'Tembo the Elephant', animated: true },
  { stickerKey: 'safari/lion', emoji: '🦁', name: 'Shumba the Lion', animated: true },
  { stickerKey: 'safari/rhino', emoji: '🦏', name: 'Rumble the Rhino', animated: true },
  { stickerKey: 'safari/hippo', emoji: '🦛', name: 'Splash the Hippo', animated: true },
  { stickerKey: 'safari/springbok', emoji: '🦌', name: 'Bounce the Springbok', animated: true },
  { stickerKey: 'safari/meerkat', emoji: '🐹', name: 'Peek the Meerkat', animated: true },
]

const ART_BY_KEY = new Map(
  [...JUNGLE_STICKER_POOL, ...SAFARI_STICKER_POOL].map((s) => [s.stickerKey, s]),
)

export function stickerEmoji(stickerKey: string): string {
  return ART_BY_KEY.get(stickerKey)?.emoji ?? '🦜'
}

/** Deterministic next sticker from a pool: walk it in order based on how
 *  many from THAT pool are already owned — no dupes until a full set. */
export function nextStickerFromPool(pool: StickerArt[], ownedKeys: string[]): StickerArt {
  const poolKeys = new Set(pool.map((s) => s.stickerKey))
  const ownedFromPool = ownedKeys.filter((k) => poolKeys.has(k)).length
  return pool[ownedFromPool % pool.length]
}

/** Back-compat helper used by Matching Builder */
export function nextJungleSticker(ownedCount: number): StickerArt {
  return JUNGLE_STICKER_POOL[ownedCount % JUNGLE_STICKER_POOL.length]
}
