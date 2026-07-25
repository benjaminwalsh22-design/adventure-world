import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  sfxEnabled: boolean
  hapticsEnabled: boolean
  toggleSfx: () => void
  toggleHaptics: () => void
}

/**
 * Player settings, persisted to localStorage so preferences survive
 * app relaunches from the home screen.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sfxEnabled: true,
      hapticsEnabled: true,
      toggleSfx: () => set((s) => ({ sfxEnabled: !s.sfxEnabled })),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
    }),
    { name: 'aw:settings:v1' },
  ),
)
