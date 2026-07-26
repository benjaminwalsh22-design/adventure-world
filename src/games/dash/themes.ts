import type { StickerArt } from '../../prize/stickerArt'
import { JUNGLE_STICKER_POOL, SAFARI_STICKER_POOL } from '../../prize/stickerArt'

/**
 * Visual + reward theming for the shared Dash runner engine.
 * One engine, many worlds: Safari (Kruger) and Jungle Gardens (Rome) ship
 * now; future cities add a theme object, not a new game.
 */

export interface DashTheme {
  key: 'safari' | 'jungle'
  title: string
  titleEmoji: string
  cityName: string
  /** sky gradient stops top→horizon */
  sky: [string, string, string]
  hillColor: string
  groundColor: string
  groundStripeColor: string
  grassColor: string
  treeEmoji: string
  bgAnimals: string[]
  /** art for each obstacle slot (mechanics stay identical across themes) */
  jumpA: string // rock-slot art
  jumpB: string // log-slot art
  duckFlyer: string // vulture-slot art
  duckHangs: string // branch-slot foliage art
  pickupEmoji: string
  pickupName: string
  finishEmojis: [string, string, string]
  finishName: string
  introLine: string
  stickerPool: StickerArt[]
  stickerBannerTitle: string
  confetti: string[]
}

export const SAFARI_THEME: DashTheme = {
  key: 'safari',
  title: 'Safari Dash',
  titleEmoji: '🦁',
  cityName: 'Kruger Park',
  sky: ['#7dd3fc', '#fde68a', '#fdba74'],
  hillColor: '#d9a05b',
  groundColor: '#e7c184',
  groundStripeColor: '#caa15f',
  grassColor: '#a3ba58',
  treeEmoji: '🌳',
  bgAnimals: ['🦒', '🦓', '🐘'],
  jumpA: '🪨',
  jumpB: '🪵',
  duckFlyer: '🦅',
  duckHangs: '🌿',
  pickupEmoji: '🐾',
  pickupName: 'paw prints',
  finishEmojis: ['🦩', '🐘', '🌊'],
  finishName: 'the waterhole',
  introLine: 'Run to the waterhole! Grab every 🐾 you can.',
  stickerPool: SAFARI_STICKER_POOL,
  stickerBannerTitle: 'New Safari Sticker!',
  confetti: ['🎉', '🐾', '🎊', '✨', '🌟', '🦒'],
}

export const JUNGLE_THEME: DashTheme = {
  key: 'jungle',
  title: 'Jungle Adventure Dash',
  titleEmoji: '🦜',
  cityName: 'Rome',
  sky: ['#86efac', '#a7f3d0', '#fef3c7'],
  hillColor: '#4d7c0f',
  groundColor: '#8f9d54',
  groundStripeColor: '#6b7a3a',
  grassColor: '#3f6212',
  treeEmoji: '🌴',
  bgAnimals: ['🦜', '🐒', '🦋'],
  jumpA: '🏺', // toppled Roman vase
  jumpB: '🪵', // fallen garden log
  duckFlyer: '🦉',
  duckHangs: '🍃', // hanging vine
  pickupEmoji: '🍇',
  pickupName: 'fruit',
  finishEmojis: ['🏛️', '⛲', '✨'],
  finishName: 'the secret garden temple',
  introLine: 'Dash through the wild Roman gardens! Grab every 🍇 you can.',
  stickerPool: JUNGLE_STICKER_POOL,
  stickerBannerTitle: 'New Jungle Sticker!',
  confetti: ['🎉', '🍇', '🎊', '✨', '🌟', '🦜'],
}
