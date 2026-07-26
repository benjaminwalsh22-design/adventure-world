/**
 * Mini-game registry. Each game plugs in as a lazy-loaded component in a
 * later build step; the registry is the single source of truth for the
 * City Game Hub cards, reward routing, and analytics keys.
 */

export type GameId =
  | 'matching_builder'
  | 'puzzle_quest'
  | 'swim_races'
  | 'jungle_dash'
  | 'reading_quest'
  | 'target_cannon'
  | 'safari_dash'

export type RewardType = 'sticker' | 'medal' | 'bookmark' | 'coins'

export interface GameDef {
  id: GameId
  name: string
  emoji: string
  blurb: string // one kid-friendly sentence
  rewardType: RewardType
  rewardLabel: string
  accent: 'sky' | 'gold' | 'emerald' | 'coral'
  /** false until the game module ships in a later build step */
  playable: boolean
  /** Which city hubs list this game */
  cities: string[]
}

export function gamesForCity(cityId: string): GameDef[] {
  return GAMES.filter((g) => g.cities.includes(cityId))
}

export const GAMES: GameDef[] = [
  {
    id: 'matching_builder',
    name: 'Matching Builder',
    emoji: '🃏',
    blurb: 'Flip cards and match landmarks, animals, and Italian words!',
    rewardType: 'sticker',
    rewardLabel: 'Win 3 in a row → Jungle Sticker',
    accent: 'sky',
    playable: true,
    cities: ['rome'],
  },
  {
    id: 'puzzle_quest',
    name: 'Puzzle Quest',
    emoji: '🧩',
    blurb: 'Snap together giant jigsaw puzzles — from 12 to 1,000 pieces!',
    rewardType: 'coins',
    rewardLabel: 'Finish puzzles → Coins',
    accent: 'gold',
    playable: true,
    cities: ['rome'],
  },
  {
    id: 'swim_races',
    name: 'Championship Swim Races',
    emoji: '🏊',
    blurb: 'Tap the rhythm to race through the Roman aqueduct pool!',
    rewardType: 'medal',
    rewardLabel: 'Win races → Medals',
    accent: 'coral',
    playable: true,
    cities: ['rome'],
  },
  {
    id: 'jungle_dash',
    name: 'Jungle Adventure Dash',
    emoji: '🦁',
    blurb: 'Jump vines and duck ruins in a wild garden run!',
    rewardType: 'sticker',
    rewardLabel: 'Finish runs → Animated Stickers',
    accent: 'emerald',
    playable: true,
    cities: ['rome'],
  },
  {
    id: 'reading_quest',
    name: 'Reading Quest',
    emoji: '📖',
    blurb: 'Read amazing true stories and answer brainy questions!',
    rewardType: 'bookmark',
    rewardLabel: 'Finish stories → Bookmarks',
    accent: 'sky',
    playable: true,
    cities: ['rome'],
  },
  {
    id: 'target_cannon',
    name: 'Target Cannon Carnival',
    emoji: '🎈',
    blurb: 'Aim your cannon and pop balloons on the Roman pillars!',
    rewardType: 'coins',
    rewardLabel: 'Pop targets → Coins',
    accent: 'gold',
    playable: true,
    cities: ['rome'],
  },
  {
    id: 'safari_dash',
    name: 'Safari Dash',
    emoji: '🦒',
    blurb: 'Run the savanna! Jump rocks, duck branches, reach the waterhole!',
    rewardType: 'sticker',
    rewardLabel: 'Finish 3 runs in a row → Animal Sticker',
    accent: 'emerald',
    playable: true,
    cities: ['kruger'],
  },
]
