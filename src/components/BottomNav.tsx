import { haptic } from '../lib/haptics'
import { playSfx } from '../lib/sfx'

export type AppView = 'globe' | 'prizes'

interface BottomNavProps {
  view: AppView
  onNavigate: (view: AppView) => void
}

const TABS: Array<{ view: AppView; label: string; emoji: string }> = [
  { view: 'globe', label: 'World', emoji: '🌍' },
  { view: 'prizes', label: 'My Trophy Room', emoji: '🏆' },
]

/**
 * Persistent bottom navigation. Sits above the iOS home indicator via
 * pb-safe. Tap targets are far beyond the 48px minimum.
 */
export function BottomNav({ view, onNavigate }: BottomNavProps) {
  return (
    <nav className="pb-safe px-safe absolute inset-x-0 bottom-0 z-30">
      <div className="mx-auto mb-1 flex max-w-md gap-2 rounded-3xl bg-night-navy/80 p-2 shadow-2xl backdrop-blur-md">
        {TABS.map((tab) => {
          const active = tab.view === view
          return (
            <button
              key={tab.view}
              type="button"
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              onPointerUp={() => {
                if (!active) {
                  haptic('tap')
                  playSfx('pop')
                  onNavigate(tab.view)
                }
              }}
              className={[
                'flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-display text-lg font-bold transition-all duration-150',
                active
                  ? 'bg-adventure-gold text-white shadow-[0_4px_0_var(--color-adventure-gold-edge)]'
                  : 'text-soft-cream/70 active:scale-95',
              ].join(' ')}
            >
              <span className="text-2xl" aria-hidden="true">
                {tab.emoji}
              </span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
