/**
 * Featured world cities shown as pins on the globe.
 * Rome ships in v1; the rest are visible "coming soon" pins so kids can
 * see the world growing (and beg their parents for the update).
 */

export interface City {
  id: string
  name: string
  country: string
  emoji: string
  lat: number
  lon: number
  status: 'open' | 'coming_soon'
  tagline: string
}

export const CITIES: City[] = [
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    emoji: '🏛️',
    lat: 41.9028,
    lon: 12.4964,
    status: 'open',
    tagline: 'Gladiators, gelato, and giant puzzles!',
  },
  {
    id: 'cairo',
    name: 'Cairo',
    country: 'Egypt',
    emoji: '🐫',
    lat: 30.0444,
    lon: 31.2357,
    status: 'coming_soon',
    tagline: 'Pyramids and mummies — coming soon!',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    emoji: '🗼',
    lat: 35.6762,
    lon: 139.6503,
    status: 'coming_soon',
    tagline: 'Robots and cherry blossoms — coming soon!',
  },
  {
    id: 'rio',
    name: 'Rio',
    country: 'Brazil',
    emoji: '🦜',
    lat: -22.9068,
    lon: -43.1729,
    status: 'coming_soon',
    tagline: 'Jungle carnival — coming soon!',
  },
  {
    id: 'london',
    name: 'London',
    country: 'England',
    emoji: '🎡',
    lat: 51.5074,
    lon: -0.1278,
    status: 'coming_soon',
    tagline: 'Castles and big red buses — coming soon!',
  },
]
