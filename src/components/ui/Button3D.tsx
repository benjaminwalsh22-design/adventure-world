import { useCallback, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

type ButtonColor = 'sky' | 'gold' | 'emerald' | 'coral' | 'cream' | 'navy'
type ButtonSize = 'md' | 'lg' | 'xl'

interface Button3DProps {
  children: ReactNode
  onTap?: () => void
  color?: ButtonColor
  size?: ButtonSize
  disabled?: boolean
  /** Stretch to fill the parent width */
  block?: boolean
  className?: string
  ariaLabel?: string
}

/**
 * The signature Adventure World tactile button.
 *
 * 3D depth = a solid box-shadow "edge" underneath the face. On press the
 * face translates down by the edge height and the shadow collapses, so the
 * button physically depresses. Driven by pointer events (not :active) so
 * behavior is identical for touch and mouse, and so we can fire haptics +
 * SFX at the exact `pointerdown` moment (feedback must be *immediate*).
 */
const FACE: Record<ButtonColor, string> = {
  sky: 'bg-sky-bright text-white',
  gold: 'bg-adventure-gold text-white',
  emerald: 'bg-emerald-jungle text-white',
  coral: 'bg-ruby-coral text-white',
  cream: 'bg-soft-cream text-night-navy',
  navy: 'bg-night-navy text-soft-cream',
}

const EDGE: Record<ButtonColor, string> = {
  sky: 'var(--color-sky-bright-edge)',
  gold: 'var(--color-adventure-gold-edge)',
  emerald: 'var(--color-emerald-jungle-edge)',
  coral: 'var(--color-ruby-coral-edge)',
  cream: 'var(--color-soft-cream-edge)',
  navy: 'var(--color-night-navy-edge)',
}

/** Every size keeps the 48x48px minimum tap target */
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-12 px-5 text-lg rounded-2xl',
  lg: 'min-h-14 px-7 text-xl rounded-2xl',
  xl: 'min-h-16 px-8 text-2xl rounded-3xl',
}

const EDGE_HEIGHT = 5 // px

export function Button3D({
  children,
  onTap,
  color = 'sky',
  size = 'lg',
  disabled = false,
  block = false,
  className = '',
  ariaLabel,
}: Button3DProps) {
  const [pressed, setPressed] = useState(false)

  const handleDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return
      e.currentTarget.setPointerCapture(e.pointerId)
      setPressed(true)
      haptic('tap')
      playSfx('tap')
    },
    [disabled],
  )

  const handleUp = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled || !pressed) return
      setPressed(false)
      // Only fire the action if the finger lifted while still on the button
      // (kids drag off buttons constantly to "cancel" — respect that).
      const rect = e.currentTarget.getBoundingClientRect()
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (inside) onTap?.()
    },
    [disabled, pressed, onTap],
  )

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={() => setPressed(false)}
      className={[
        'select-none font-display font-semibold tracking-wide',
        'transition-transform duration-75 ease-out will-change-transform',
        'focus-visible:outline-4 focus-visible:outline-adventure-gold',
        FACE[color],
        SIZES[size],
        block ? 'w-full' : '',
        disabled ? 'opacity-50 saturate-50' : '',
        className,
      ].join(' ')}
      style={{
        boxShadow: pressed
          ? `0 0 0 ${EDGE[color]}, 0 2px 6px rgba(30, 27, 75, 0.15)`
          : `0 ${EDGE_HEIGHT}px 0 ${EDGE[color]}, 0 ${EDGE_HEIGHT + 4}px 12px rgba(30, 27, 75, 0.25)`,
        transform: pressed ? `translateY(${EDGE_HEIGHT}px) scale(0.98)` : 'translateY(0)',
        touchAction: 'manipulation',
      }}
    >
      {children}
    </button>
  )
}
