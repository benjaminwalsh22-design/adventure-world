import { useEffect } from 'react'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

export interface RewardBannerData {
  emoji: string // e.g. 🥇 🦜 🔖
  headline: string // "You won a Gold Medal!"
  sub?: string // "Check it out in your Trophy Room"
}

interface RewardBannerProps {
  reward: RewardBannerData | null
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 3200

/**
 * Celebration banner that drops from the top when a reward is earned.
 * Auto-plays the reward fanfare + haptic burst, then self-dismisses.
 */
export function RewardBanner({ reward, onDismiss }: RewardBannerProps) {
  useEffect(() => {
    if (!reward) return
    playSfx('reward')
    haptic('reward')
    const t = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
  }, [reward, onDismiss])

  if (!reward) return null

  return (
    <div className="pt-safe px-safe pointer-events-none absolute inset-x-0 top-0 z-[70] flex justify-center">
      <div
        onPointerUp={onDismiss}
        className="animate-bounce-in pointer-events-auto mt-14 flex items-center gap-4 rounded-3xl bg-adventure-gold px-6 py-4 shadow-[0_6px_0_var(--color-adventure-gold-edge),0_12px_24px_rgba(30,27,75,0.4)]"
        role="status"
      >
        <span className="animate-wiggle text-4xl" aria-hidden="true">
          {reward.emoji}
        </span>
        <div>
          <p className="font-display text-xl leading-tight font-bold text-white">
            {reward.headline}
          </p>
          {reward.sub && <p className="text-base font-bold text-white/85">{reward.sub}</p>}
        </div>
      </div>
    </div>
  )
}
