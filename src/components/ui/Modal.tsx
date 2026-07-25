import type { ReactNode } from 'react'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** 'sheet' slides from the bottom (city hub), 'center' pops in (dialogs) */
  variant?: 'sheet' | 'center'
}

/**
 * Kid-friendly modal: bounce-in entrance, giant 48px close button,
 * dimmed backdrop tap-to-close, safe-area aware padding.
 */
export function Modal({ open, onClose, title, children, variant = 'center' }: ModalProps) {
  if (!open) return null

  const close = () => {
    haptic('tap')
    playSfx('pop')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-night-navy/60 backdrop-blur-sm"
        onPointerUp={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={[
          'relative bg-soft-cream shadow-2xl',
          variant === 'sheet'
            ? 'animate-bounce-in mx-auto max-h-[88%] w-full max-w-lg rounded-t-[2.5rem] pb-safe'
            : 'animate-pop-in m-auto max-h-[85%] w-[calc(100%-2rem)] max-w-md rounded-[2rem] pb-6',
        ].join(' ')}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
          {title ? (
            <h2 className="font-display text-2xl font-bold text-night-navy">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Close"
            onPointerUp={close}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ruby-coral text-2xl font-bold text-white shadow-[0_4px_0_var(--color-ruby-coral-edge)] active:translate-y-1 active:shadow-none"
          >
            ✕
          </button>
        </div>

        <div className="scroll-panel max-h-[70vh] px-6 pt-2 pb-4">{children}</div>
      </div>
    </div>
  )
}
