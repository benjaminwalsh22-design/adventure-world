import type { ReactNode } from 'react'
import { useRewardsStore } from '../state/useRewardsStore'
import type { MedalTier } from '../state/useRewardsStore'
import { stickerEmoji } from './stickerArt'
import { bookmarkArt } from './bookmarkArt'

/* ---------------------------------------------------------------------------
   View 2 — My Trophy Room.
   v1 ships the three collection shelves reading live from the persisted
   rewards store. The interactive drag-and-drop safari canvas for stickers
   arrives with the Jungle Dash build step (placement data model is already
   in the store: Sticker.placement).
   ------------------------------------------------------------------------ */

const MEDAL_EMOJI: Record<MedalTier, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  diamond: '💎',
}

function Shelf({
  title,
  emoji,
  count,
  emptyHint,
  children,
}: {
  title: string
  emoji: string
  count: number
  emptyHint: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl bg-soft-cream p-4 shadow-[0_5px_0_var(--color-soft-cream-edge),0_10px_20px_rgba(30,27,75,0.35)]">
      <div className="flex items-center justify-between pb-3">
        <h3 className="font-display text-xl font-bold text-night-navy">
          <span aria-hidden="true">{emoji}</span> {title}
        </h3>
        <span className="rounded-full bg-adventure-gold px-3 py-0.5 font-display text-base font-bold text-white">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="rounded-2xl border-4 border-dashed border-night-navy/15 px-4 py-6 text-center text-base font-bold text-night-navy/40">
          {emptyHint}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-3">{children}</div>
      )}
    </section>
  )
}

export function PrizeRoom() {
  const { medals, stickers, bookmarks } = useRewardsStore()

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-night-navy via-[#312e81] to-night-navy">
      <div className="scroll-panel pt-safe px-safe h-full pb-40">
        <h1 className="animate-pop-in py-4 text-center font-display text-3xl font-bold text-adventure-gold">
          🏆 My Trophy Room
        </h1>

        <div className="mx-auto flex max-w-lg flex-col gap-4">
          <Shelf
            title="Medals Case"
            emoji="🏅"
            count={medals.length}
            emptyHint="Win Swim Races in Rome to earn shiny medals!"
          >
            {medals.map((m) => (
              <div
                key={m.id}
                className="animate-pop-in flex aspect-square flex-col items-center justify-center rounded-2xl bg-white text-4xl shadow-inner"
                title={m.eventName}
              >
                {MEDAL_EMOJI[m.tier]}
              </div>
            ))}
          </Shelf>

          <Shelf
            title="Bookmark Binder"
            emoji="🔖"
            count={bookmarks.length}
            emptyHint="Finish Reading Quests to collect cool bookmarks!"
          >
            {bookmarks.map((b) => {
              const art = bookmarkArt(b.bookmarkKey)
              return (
                <div
                  key={b.id}
                  className="animate-pop-in flex aspect-[3/5] items-start justify-center pt-2 text-2xl shadow-md"
                  style={{
                    background: art.gradient,
                    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%)',
                  }}
                  title={`${b.name} — ${b.storyTitle}`}
                >
                  {art.emoji}
                </div>
              )
            })}
          </Shelf>

          <Shelf
            title="Sticker Book"
            emoji="🦜"
            count={stickers.length}
            emptyHint="Play Jungle Games to win stickers for your safari!"
          >
            {stickers.map((s) => (
              <div
                key={s.id}
                className="animate-pop-in flex aspect-square flex-col items-center justify-center rounded-2xl bg-white shadow-inner"
                title={s.name}
              >
                {/* Animated stickers gently float — earned from Safari Dash */}
                <span className={s.animated ? 'animate-float text-3xl' : 'text-3xl'}>
                  {stickerEmoji(s.stickerKey)}
                </span>
              </div>
            ))}
          </Shelf>
        </div>
      </div>
    </div>
  )
}
