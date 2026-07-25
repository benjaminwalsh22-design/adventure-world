import { Modal } from './ui/Modal'
import { useSettingsStore } from '../state/useSettingsStore'
import { haptic } from '../lib/haptics'
import { playSfx } from '../lib/sfx'

interface SettingsOverlayProps {
  open: boolean
  onClose: () => void
}

function ToggleRow({
  label,
  emoji,
  checked,
  onToggle,
}: {
  label: string
  emoji: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onPointerUp={() => {
        onToggle()
        haptic('tap')
        playSfx('tap')
      }}
      className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-white px-4 py-2 shadow-[0_3px_0_var(--color-soft-cream-edge)]"
    >
      <span className="flex items-center gap-3 font-display text-xl font-semibold text-night-navy">
        <span className="text-2xl" aria-hidden="true">
          {emoji}
        </span>
        {label}
      </span>
      {/* Big, obvious switch */}
      <span
        className={[
          'relative h-9 w-16 rounded-full transition-colors duration-200',
          checked ? 'bg-emerald-jungle' : 'bg-night-navy/20',
        ].join(' ')}
        aria-hidden="true"
      >
        <span
          className={[
            'absolute top-1 size-7 rounded-full bg-white shadow-md transition-transform duration-200',
            checked ? 'translate-x-8' : 'translate-x-1',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

export function SettingsOverlay({ open, onClose }: SettingsOverlayProps) {
  const { sfxEnabled, hapticsEnabled, toggleSfx, toggleHaptics } = useSettingsStore()

  return (
    <Modal open={open} onClose={onClose} title="Settings" variant="center">
      <div className="flex flex-col gap-3 pb-2">
        <ToggleRow label="Sounds" emoji="🔊" checked={sfxEnabled} onToggle={toggleSfx} />
        <ToggleRow label="Buzz" emoji="📳" checked={hapticsEnabled} onToggle={toggleHaptics} />
        <p className="pt-2 text-center text-base font-bold text-night-navy/50">
          Adventure World v0.1 · Made for explorers ages 8–10
        </p>
      </div>
    </Modal>
  )
}
