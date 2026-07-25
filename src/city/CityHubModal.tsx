import { Modal } from '../components/ui/Modal'
import type { City } from '../globe/cities'
import type { GameDef, GameId } from './games'
import { GAMES } from './games'
import { haptic } from '../lib/haptics'
import { playSfx } from '../lib/sfx'

interface CityHubModalProps {
  city: City | null
  onClose: () => void
  onPlayGame: (gameId: GameId) => void
}

const ACCENT_BG: Record<GameDef['accent'], string> = {
  sky: 'bg-sky-bright',
  gold: 'bg-adventure-gold',
  emerald: 'bg-emerald-jungle',
  coral: 'bg-ruby-coral',
}

const ACCENT_EDGE: Record<GameDef['accent'], string> = {
  sky: 'var(--color-sky-bright-edge)',
  gold: 'var(--color-adventure-gold-edge)',
  emerald: 'var(--color-emerald-jungle-edge)',
  coral: 'var(--color-ruby-coral-edge)',
}

/**
 * View 1b — City Game Hub. Slides up as a bottom sheet after the camera
 * zooms into a city. Games not yet shipped render as "Building…" cards so
 * kids see the whole roadmap of fun.
 */
export function CityHubModal({ city, onClose, onPlayGame }: CityHubModalProps) {
  return (
    <Modal
      open={city !== null}
      onClose={onClose}
      title={city ? `${city.emoji} ${city.name}, ${city.country}` : ''}
      variant="sheet"
    >
      {city && (
        <>
          <p className="pb-4 font-body text-lg font-bold text-night-navy/60">{city.tagline}</p>
          <div className="grid grid-cols-1 gap-3 pb-2">
            {GAMES.map((game) => (
              <button
                key={game.id}
                type="button"
                disabled={!game.playable}
                onPointerUp={() => {
                  if (!game.playable) {
                    playSfx('error')
                    return
                  }
                  haptic('tap')
                  playSfx('pop')
                  onPlayGame(game.id)
                }}
                className={[
                  'flex min-h-20 items-center gap-4 rounded-3xl px-4 py-3 text-left transition-transform duration-75',
                  ACCENT_BG[game.accent],
                  game.playable ? 'active:translate-y-1' : 'opacity-70 saturate-[0.65]',
                ].join(' ')}
                style={{
                  boxShadow: game.playable
                    ? `0 5px 0 ${ACCENT_EDGE[game.accent]}, 0 9px 14px rgba(30,27,75,0.25)`
                    : 'none',
                }}
              >
                <span
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-3xl"
                  aria-hidden="true"
                >
                  {game.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl leading-tight font-bold text-white">
                    {game.name}
                  </span>
                  <span className="block truncate text-base font-bold text-white/80">
                    {game.playable ? game.rewardLabel : '🔨 Builders are working on this one!'}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full bg-white/25 px-3 py-1 font-display text-base font-bold text-white"
                  aria-hidden="true"
                >
                  {game.playable ? 'PLAY' : 'SOON'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
