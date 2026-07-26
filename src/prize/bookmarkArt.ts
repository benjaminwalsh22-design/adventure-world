/**
 * Bookmark catalog — decorative designs earned from Reading Quest.
 * Rendered as CSS-gradient ribbons in the Prize Room.
 */

export interface BookmarkArt {
  bookmarkKey: string
  emoji: string
  /** CSS gradient for the ribbon */
  gradient: string
}

const BOOKMARKS: BookmarkArt[] = [
  {
    bookmarkKey: 'bookmarks/colosseum-gold',
    emoji: '🏛️',
    gradient: 'linear-gradient(160deg, #fbbf24, #b45309)',
  },
  {
    bookmarkKey: 'bookmarks/aqueduct-blue',
    emoji: '🌉',
    gradient: 'linear-gradient(160deg, #60a5fa, #1d4ed8)',
  },
  {
    bookmarkKey: 'bookmarks/vesuvius-red',
    emoji: '🌋',
    gradient: 'linear-gradient(160deg, #f87171, #991b1b)',
  },
  {
    bookmarkKey: 'bookmarks/wolf-silver',
    emoji: '🐺',
    gradient: 'linear-gradient(160deg, #e5e7eb, #6b7280)',
  },
  {
    bookmarkKey: 'bookmarks/road-stone',
    emoji: '🛤️',
    gradient: 'linear-gradient(160deg, #d6bfa2, #78716c)',
  },
  {
    bookmarkKey: 'bookmarks/sea-teal',
    emoji: '🌊',
    gradient: 'linear-gradient(160deg, #5eead4, #0f766e)',
  },
]

const BY_KEY = new Map(BOOKMARKS.map((b) => [b.bookmarkKey, b]))

export function bookmarkArt(bookmarkKey: string): BookmarkArt {
  return (
    BY_KEY.get(bookmarkKey) ?? {
      bookmarkKey,
      emoji: '🔖',
      gradient: 'linear-gradient(160deg, #f59e0b, #b45309)',
    }
  )
}
