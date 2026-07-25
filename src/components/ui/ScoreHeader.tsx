import { useRewardsStore } from '../../state/useRewardsStore'

interface ScoreHeaderProps {
  onOpenSettings: () => void
}

/**
 * Persistent top bar: coin balance (left) + settings gear (right).
 * Sits inside the safe area so it never collides with the iOS notch.
 */
export function ScoreHeader({ onOpenSettings }: ScoreHeaderProps) {
  const coins = useRewardsStore((s) => s.coins)

  return (
    <header className="pt-safe px-safe pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between">
      {/* Coin pill */}
      <div className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-full bg-night-navy/70 py-1 pr-5 pl-2 shadow-lg backdrop-blur-md">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full bg-adventure-gold text-lg shadow-[inset_0_-3px_0_var(--color-adventure-gold-edge)]"
        >
          🪙
        </span>
        <span className="font-display text-xl font-bold text-adventure-gold" aria-label={`${coins} coins`}>
          {coins}
        </span>
      </div>

      {/* Settings gear — always accessible, top-right per design spec */}
      <button
        type="button"
        aria-label="Settings"
        onPointerUp={onOpenSettings}
        className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-night-navy/70 text-2xl shadow-lg backdrop-blur-md active:scale-90"
      >
        ⚙️
      </button>
    </header>
  )
}
