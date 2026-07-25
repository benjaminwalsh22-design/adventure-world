import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { City } from './cities'
import { CITIES } from './cities'
import { GlobeScene } from './GlobeScene'
import { haptic } from '../lib/haptics'
import { playSfx } from '../lib/sfx'

export interface GlobeHubHandle {
  /** Dolly the camera back out after the city hub closes. */
  resetView: () => void
}

interface GlobeHubProps {
  /** Called once the zoom-in animation lands on an open city. */
  onCityOpen: (city: City) => void
}

/**
 * View 1 — the 3D Globe Hub.
 *
 * React owns: mounting, DOM labels, the "coming soon" toast.
 * GlobeScene owns: everything per-frame. The two meet through refs so no
 * React state updates ever happen inside the render loop.
 */
export const GlobeHub = forwardRef<GlobeHubHandle, GlobeHubProps>(function GlobeHub(
  { onCityOpen },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<GlobeScene | null>(null)
  const onCityOpenRef = useRef(onCityOpen)
  onCityOpenRef.current = onCityOpen

  const labelEls = useRef(new Map<string, HTMLElement>())
  const [comingSoonCity, setComingSoonCity] = useState<City | null>(null)
  const toastTimer = useRef(0)

  useImperativeHandle(ref, () => ({
    resetView: () => sceneRef.current?.resetView(),
  }))

  const handleCityTap = useCallback((city: City) => {
    haptic('tap')
    if (city.status === 'open') {
      playSfx('whoosh')
      sceneRef.current?.focusCity(city)
    } else {
      playSfx('pop')
      setComingSoonCity(city)
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setComingSoonCity(null), 2200)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const scene = new GlobeScene(container, canvas, {
      onCityTap: handleCityTap,
      onCityFocused: (city) => onCityOpenRef.current(city),
    })
    scene.addCityPins(CITIES)
    sceneRef.current = scene
    // Labels mounted before the scene existed — register them now.
    for (const [cityId, el] of labelEls.current) scene.registerLabel(cityId, el)

    return () => {
      scene.dispose()
      sceneRef.current = null
      window.clearTimeout(toastTimer.current)
    }
  }, [handleCityTap])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-gradient-to-b from-night-navy via-[#312e81] to-night-navy"
    >
      <canvas ref={canvasRef} className="block size-full touch-none" aria-label="Spinning world globe" />

      {/* City labels — DOM chips positioned by GlobeScene each frame */}
      {CITIES.map((city) => (
        <div
          key={city.id}
          ref={(el) => {
            if (el) labelEls.current.set(city.id, el)
            else labelEls.current.delete(city.id)
            sceneRef.current?.registerLabel(city.id, el)
          }}
          className={[
            'pointer-events-none absolute top-0 left-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-base font-bold whitespace-nowrap shadow-lg transition-opacity duration-150 will-change-transform',
            city.status === 'open'
              ? 'bg-adventure-gold text-white'
              : 'bg-soft-cream/80 text-night-navy/70',
          ].join(' ')}
          style={{ opacity: 0 }}
        >
          <span aria-hidden="true">{city.emoji}</span>
          {city.name}
          {city.status === 'coming_soon' && <span className="text-xs">🔒</span>}
        </div>
      ))}

      {/* Helper hint for first-time explorers */}
      <p className="pointer-events-none absolute inset-x-0 bottom-28 text-center font-display text-lg font-semibold text-soft-cream/60">
        Spin the world · Tap a golden pin!
      </p>

      {/* Coming-soon toast */}
      {comingSoonCity && (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 flex justify-center">
          <div className="animate-pop-in rounded-3xl bg-night-navy/85 px-6 py-4 text-center shadow-2xl backdrop-blur-md">
            <p className="font-display text-xl font-bold text-soft-cream">
              {comingSoonCity.emoji} {comingSoonCity.name} is coming soon!
            </p>
            <p className="text-base font-bold text-soft-cream/70">{comingSoonCity.tagline}</p>
          </div>
        </div>
      )}
    </div>
  )
})
