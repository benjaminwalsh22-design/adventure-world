/**
 * Haptic feedback helper.
 *
 * `navigator.vibrate` is supported on Android Chrome / Samsung Internet.
 * iOS Safari does not expose it — we feature-detect and no-op silently so
 * the same call sites work everywhere. (On iOS the audio "pop" SFX +
 * button depress animation carry the tactile feel instead.)
 */

import { useSettingsStore } from '../state/useSettingsStore'

type HapticPattern = 'tap' | 'success' | 'reward' | 'error'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [15, 40, 25],
  reward: [20, 50, 20, 50, 60],
  error: [40, 60, 40],
}

export function haptic(pattern: HapticPattern = 'tap'): void {
  if (!useSettingsStore.getState().hapticsEnabled) return
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(PATTERNS[pattern])
    } catch {
      /* never let haptics crash gameplay */
    }
  }
}
