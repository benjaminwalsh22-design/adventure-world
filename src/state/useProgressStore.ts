import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Per-game progression, persisted so a kid resumes exactly where they left
 * off after the PWA is relaunched (or iOS evicts it from memory).
 *
 * Matching Builder rules:
 *  - level only ever climbs (endless scaling)
 *  - winStreak counts CONSECUTIVE completed rounds; quitting a round
 *    mid-play resets it. Every 3rd consecutive win pays out a Jungle
 *    Sticker (handled by the game screen, which also resets the streak).
 */
interface ProgressState {
  matchingLevel: number
  matchingStreak: number
  advanceMatching: (opts: { streakAfterRound: number }) => void
  resetMatchingStreak: () => void
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      matchingLevel: 1,
      matchingStreak: 0,

      advanceMatching: ({ streakAfterRound }) =>
        set((s) => ({
          matchingLevel: s.matchingLevel + 1,
          matchingStreak: streakAfterRound,
        })),

      resetMatchingStreak: () => set({ matchingStreak: 0 }),
    }),
    { name: 'aw:progress:v1', version: 1 },
  ),
)
