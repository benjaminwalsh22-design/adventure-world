import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { GlobeHub } from './globe/GlobeHub'
import type { GlobeHubHandle } from './globe/GlobeHub'
import type { City } from './globe/cities'
import { CityHubModal } from './city/CityHubModal'
import type { GameId } from './city/games'
import { PrizeRoom } from './prize/PrizeRoom'
import { BottomNav } from './components/BottomNav'
import type { AppView } from './components/BottomNav'
import { ScoreHeader } from './components/ui/ScoreHeader'
import { RewardBanner } from './components/ui/RewardBanner'
import type { RewardBannerData } from './components/ui/RewardBanner'
import { SettingsOverlay } from './components/SettingsOverlay'

/* Mini-games are lazy routes — the globe shell stays light and each game
   downloads on first play (then lives in the HTTP cache for offline use). */
const MatchingBuilder = lazy(() => import('./games/matching/MatchingBuilder'))

const GAME_COMPONENTS: Partial<
  Record<GameId, React.LazyExoticComponent<React.ComponentType<GameScreenProps>>>
> = {
  matching_builder: MatchingBuilder,
}

interface GameScreenProps {
  onExit: () => void
  onReward: (banner: RewardBannerData) => void
}

export default function App() {
  const [view, setView] = useState<AppView>('globe')
  const [activeCity, setActiveCity] = useState<City | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reward, setReward] = useState<RewardBannerData | null>(null)
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const globeRef = useRef<GlobeHubHandle>(null)

  const handleCityOpen = useCallback((city: City) => {
    setActiveCity(city)
  }, [])

  const handleCityClose = useCallback(() => {
    setActiveCity(null)
    globeRef.current?.resetView()
  }, [])

  const handlePlayGame = useCallback((gameId: GameId) => {
    if (GAME_COMPONENTS[gameId]) setActiveGame(gameId)
  }, [])

  const ActiveGame = activeGame ? GAME_COMPONENTS[activeGame] : undefined

  return (
    <div className="relative h-full w-full overflow-hidden bg-night-navy">
      {/* Globe stays mounted while in the Trophy Room — keeps the WebGL
          context warm so tab-switching back is instant (no re-init jank). */}
      <div className={view === 'globe' ? 'absolute inset-0' : 'absolute inset-0 invisible'}>
        <GlobeHub ref={globeRef} onCityOpen={handleCityOpen} />
      </div>

      {view === 'prizes' && <PrizeRoom />}

      <ScoreHeader onOpenSettings={() => setSettingsOpen(true)} />
      <BottomNav
        view={view}
        onNavigate={(v) => {
          setView(v)
          if (v === 'prizes') handleCityClose()
        }}
      />

      <CityHubModal city={activeCity} onClose={handleCityClose} onPlayGame={handlePlayGame} />
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Active mini-game — covers the city hub; closing reveals it again */}
      {ActiveGame && (
        <Suspense
          fallback={
            <div className="absolute inset-0 z-[55] flex items-center justify-center bg-night-navy">
              <p className="animate-float font-display text-2xl font-bold text-adventure-gold">
                🎒 Packing the game…
              </p>
            </div>
          }
        >
          <ActiveGame onExit={() => setActiveGame(null)} onReward={setReward} />
        </Suspense>
      )}

      <RewardBanner reward={reward} onDismiss={() => setReward(null)} />
    </div>
  )
}
