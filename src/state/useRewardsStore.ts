import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ---------------------------------------------------------------------------
   Reward domain model — everything a kid can earn and keep.
   Persisted to localStorage (versioned key + migrate hook) so the Trophy
   Room survives app relaunches and OS-level app kills.
   ------------------------------------------------------------------------ */

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'diamond'

export interface Medal {
  id: string
  tier: MedalTier
  eventName: string // e.g. "Roman Aqueduct 50m Sprint"
  cityId: string
  earnedAt: number // epoch ms
}

export interface Sticker {
  id: string
  stickerKey: string // art asset key, e.g. "jungle/toucan"
  name: string
  animated: boolean
  earnedAt: number
  /** Position on the safari canvas once placed; null = still on the sheet */
  placement: { x: number; y: number; rotation: number } | null
}

export interface Bookmark {
  id: string
  bookmarkKey: string // art asset key, e.g. "bookmarks/colosseum-gold"
  name: string
  storyTitle: string // which reading quest earned it
  earnedAt: number
}

interface RewardsState {
  coins: number
  medals: Medal[]
  stickers: Sticker[]
  bookmarks: Bookmark[]

  addCoins: (amount: number) => void
  spendCoins: (amount: number) => boolean
  awardMedal: (medal: Omit<Medal, 'id' | 'earnedAt'>) => Medal
  awardSticker: (sticker: Omit<Sticker, 'id' | 'earnedAt' | 'placement'>) => Sticker
  awardBookmark: (bookmark: Omit<Bookmark, 'id' | 'earnedAt'>) => Bookmark
  placeSticker: (stickerId: string, placement: Sticker['placement']) => void
}

let uidCounter = 0
const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`

export const useRewardsStore = create<RewardsState>()(
  persist(
    (set, get) => ({
      coins: 0,
      medals: [],
      stickers: [],
      bookmarks: [],

      addCoins: (amount) => set((s) => ({ coins: Math.max(0, s.coins + amount) })),

      spendCoins: (amount) => {
        if (get().coins < amount) return false
        set((s) => ({ coins: s.coins - amount }))
        return true
      },

      awardMedal: (medal) => {
        const full: Medal = { ...medal, id: uid('medal'), earnedAt: Date.now() }
        set((s) => ({ medals: [...s.medals, full] }))
        return full
      },

      awardSticker: (sticker) => {
        const full: Sticker = {
          ...sticker,
          id: uid('sticker'),
          earnedAt: Date.now(),
          placement: null,
        }
        set((s) => ({ stickers: [...s.stickers, full] }))
        return full
      },

      awardBookmark: (bookmark) => {
        const full: Bookmark = { ...bookmark, id: uid('bookmark'), earnedAt: Date.now() }
        set((s) => ({ bookmarks: [...s.bookmarks, full] }))
        return full
      },

      placeSticker: (stickerId, placement) =>
        set((s) => ({
          stickers: s.stickers.map((st) => (st.id === stickerId ? { ...st, placement } : st)),
        })),
    }),
    {
      name: 'aw:rewards:v1',
      version: 1,
      // Future-proofing: bump `version` and transform old shapes here
      // instead of ever losing a kid's trophy collection.
      migrate: (persisted) => persisted as RewardsState,
    },
  ),
)
