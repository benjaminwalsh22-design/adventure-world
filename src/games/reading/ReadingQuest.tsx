import { useCallback, useEffect, useRef, useState } from 'react'
import type { Story } from './stories'
import { STORIES } from './stories'
import { Button3D } from '../../components/ui/Button3D'
import type { RewardBannerData } from '../../components/ui/RewardBanner'
import { useProgressStore } from '../../state/useProgressStore'
import { useRewardsStore } from '../../state/useRewardsStore'
import { bookmarkArt } from '../../prize/bookmarkArt'
import { haptic } from '../../lib/haptics'
import { playSfx } from '../../lib/sfx'

interface GameScreenProps {
  onExit: () => void
  onReward: (banner: RewardBannerData) => void
}

const BOOKMARK_THRESHOLD = 2 // first-try correct answers needed (of 3)

/** Tap-to-listen via the Web Speech API (built into iOS Safari). */
function useReadAloud() {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.92 // a touch slower for young listeners
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
      setSpeaking(true)
    },
    [supported],
  )

  useEffect(() => stop, [stop]) // cancel on unmount
  return { supported, speaking, speak, stop }
}

type Mode =
  | { view: 'shelf' }
  | { view: 'read'; story: Story }
  | { view: 'quiz'; story: Story; qIndex: number; firstTryCorrect: number; attempted: boolean }
  | { view: 'result'; story: Story; firstTryCorrect: number; earned: boolean; coins: number }

export default function ReadingQuest({ onExit, onReward }: GameScreenProps) {
  const [mode, setMode] = useState<Mode>({ view: 'shelf' })
  const [wrongPick, setWrongPick] = useState<number | null>(null)
  const completed = useProgressStore((s) => s.completedStories)
  const { supported, speaking, speak, stop } = useReadAloud()
  const wrongTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(wrongTimer.current), [])

  const finishQuiz = useCallback(
    (story: Story, firstTryCorrect: number) => {
      const rewards = useRewardsStore.getState()
      const progress = useProgressStore.getState()
      const alreadyDone = progress.completedStories.includes(story.id)
      const earned = firstTryCorrect >= BOOKMARK_THRESHOLD && !alreadyDone
      const coins = 5 + firstTryCorrect * 5

      rewards.addCoins(coins)
      if (earned) {
        rewards.awardBookmark({
          bookmarkKey: story.bookmarkKey,
          name: story.bookmarkName,
          storyTitle: story.title,
        })
        progress.completeStory(story.id)
        onReward({
          emoji: '🔖',
          headline: 'You earned a bookmark!',
          sub: `"${story.bookmarkName}" is in your Bookmark Binder`,
        })
      } else {
        playSfx('reward')
        haptic('success')
      }
      setMode({ view: 'result', story, firstTryCorrect, earned, coins })
    },
    [onReward],
  )

  const answer = (story: Story, qIndex: number, firstTryCorrect: number, attempted: boolean, pick: number) => {
    const correct = STORIES.find((s) => s.id === story.id)!.questions[qIndex].answer === pick
    if (correct) {
      playSfx('success')
      haptic('success')
      const newScore = firstTryCorrect + (attempted ? 0 : 1)
      if (qIndex + 1 < story.questions.length) {
        setMode({ view: 'quiz', story, qIndex: qIndex + 1, firstTryCorrect: newScore, attempted: false })
      } else {
        finishQuiz(story, newScore)
      }
    } else {
      // gentle: mark the wrong pick, let them try again (first-try credit lost)
      playSfx('error')
      setWrongPick(pick)
      window.clearTimeout(wrongTimer.current)
      wrongTimer.current = window.setTimeout(() => setWrongPick(null), 700)
      setMode({ view: 'quiz', story, qIndex, firstTryCorrect, attempted: true })
    }
  }

  /* ---------- shelf ---------- */
  if (mode.view === 'shelf') {
    return (
      <div className="absolute inset-0 z-[55] bg-gradient-to-b from-[#312e81] via-night-navy to-[#312e81]">
        <header className="pt-safe px-safe flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to Rome"
            onPointerUp={onExit}
            className="flex size-12 items-center justify-center rounded-full bg-night-navy/60 text-xl text-white backdrop-blur-md active:scale-90"
          >
            ◀
          </button>
          <h1 className="font-display text-2xl font-bold text-adventure-gold">📖 Reading Quest</h1>
        </header>
        <div className="px-safe scroll-panel h-full pt-4 pb-32">
          <p className="pb-4 text-center text-lg font-bold text-soft-cream/70">
            Pick a true story · answer 3 questions · earn a bookmark!
          </p>
          <div className="mx-auto flex max-w-md flex-col gap-3">
            {STORIES.map((story) => {
              const done = completed.includes(story.id)
              return (
                <button
                  key={story.id}
                  type="button"
                  onPointerUp={() => {
                    haptic('tap')
                    playSfx('pop')
                    setMode({ view: 'read', story })
                  }}
                  className="flex min-h-20 items-center gap-4 rounded-3xl bg-soft-cream px-4 py-3 text-left shadow-[0_5px_0_var(--color-soft-cream-edge)] active:translate-y-1"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-sky-bright/15 text-3xl">
                    {story.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl leading-tight font-bold text-night-navy">
                      {story.title}
                    </span>
                    <span className="block text-base font-bold text-night-navy/50 capitalize">
                      {story.topic}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xl">{done ? '✅' : '🔖'}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  /* ---------- reading ---------- */
  if (mode.view === 'read') {
    const { story } = mode
    return (
      <div className="absolute inset-0 z-[55] bg-soft-cream">
        <header className="pt-safe px-safe flex items-center justify-between gap-3 bg-soft-cream/95 pb-2">
          <button
            type="button"
            aria-label="Back to stories"
            onPointerUp={() => {
              stop()
              setMode({ view: 'shelf' })
            }}
            className="flex size-12 items-center justify-center rounded-full bg-night-navy/10 text-xl text-night-navy active:scale-90"
          >
            ◀
          </button>
          {supported && (
            <button
              type="button"
              aria-label={speaking ? 'Stop reading aloud' : 'Read aloud to me'}
              onPointerUp={() =>
                speaking ? stop() : speak(`${story.title}. ${story.paragraphs.join(' ')}`)
              }
              className={[
                'flex min-h-12 items-center gap-2 rounded-full px-5 font-display text-lg font-bold',
                speaking
                  ? 'bg-ruby-coral text-white shadow-[0_4px_0_var(--color-ruby-coral-edge)]'
                  : 'bg-sky-bright text-white shadow-[0_4px_0_var(--color-sky-bright-edge)]',
              ].join(' ')}
            >
              {speaking ? '⏹ Stop' : '🔊 Listen'}
            </button>
          )}
        </header>
        <div className="px-safe scroll-panel h-full pb-44">
          <div className="mx-auto max-w-md">
            <p className="pt-2 text-center text-6xl">{story.emoji}</p>
            <h1 className="py-3 text-center font-display text-3xl font-bold text-night-navy">
              {story.title}
            </h1>
            {story.paragraphs.map((p, i) => (
              <p key={i} className="pb-4 text-lg leading-relaxed font-semibold text-night-navy/85">
                {p}
              </p>
            ))}
            <div className="pb-8">
              <Button3D
                color="sky"
                size="xl"
                block
                onTap={() => {
                  stop()
                  setMode({ view: 'quiz', story, qIndex: 0, firstTryCorrect: 0, attempted: false })
                }}
                ariaLabel="Start the questions"
              >
                I'm ready for the questions! 🧠
              </Button3D>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- quiz ---------- */
  if (mode.view === 'quiz') {
    const { story, qIndex, firstTryCorrect, attempted } = mode
    const question = story.questions[qIndex]
    return (
      <div className="absolute inset-0 z-[55] bg-gradient-to-b from-[#312e81] via-night-navy to-[#312e81]">
        <header className="pt-safe px-safe flex items-center justify-between">
          <button
            type="button"
            aria-label="Back to the story"
            onPointerUp={() => setMode({ view: 'read', story })}
            className="flex size-12 items-center justify-center rounded-full bg-night-navy/60 text-xl text-white backdrop-blur-md active:scale-90"
          >
            ◀
          </button>
          <span className="rounded-full bg-night-navy/60 px-4 py-1.5 font-display text-lg font-bold text-adventure-gold backdrop-blur-md">
            Question {qIndex + 1} of {story.questions.length}
          </span>
          <span className="size-12" aria-hidden="true" />
        </header>
        <div className="px-safe flex h-full flex-col justify-center pb-24">
          <div className="mx-auto w-full max-w-md">
            <p className="pb-1 text-center text-4xl">{story.emoji}</p>
            <h2 className="pb-6 text-center font-display text-2xl leading-snug font-bold text-soft-cream">
              {question.q}
            </h2>
            <div className="flex flex-col gap-3">
              {question.choices.map((choice, i) => (
                <button
                  key={i}
                  type="button"
                  data-choice={i}
                  onPointerUp={() => answer(story, qIndex, firstTryCorrect, attempted, i)}
                  className={[
                    'min-h-16 rounded-3xl px-5 py-3 font-display text-xl font-bold transition-all',
                    wrongPick === i
                      ? 'animate-wiggle bg-ruby-coral/60 text-white'
                      : 'bg-soft-cream text-night-navy shadow-[0_5px_0_var(--color-soft-cream-edge)] active:translate-y-1',
                  ].join(' ')}
                >
                  {choice}
                </button>
              ))}
            </div>
            {attempted && (
              <p className="pt-4 text-center text-base font-bold text-soft-cream/60">
                Almost! Give it another try 💭
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ---------- result ---------- */
  const { story, firstTryCorrect, earned, coins } = mode
  const art = bookmarkArt(story.bookmarkKey)
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-gradient-to-b from-[#312e81] via-night-navy to-[#312e81]">
      <div className="animate-bounce-in mx-6 w-full max-w-sm rounded-[2rem] bg-soft-cream p-6 text-center shadow-2xl">
        <h2 className="font-display text-3xl font-bold text-night-navy">
          {firstTryCorrect === 3 ? 'Perfect reading! 🌟' : firstTryCorrect >= 2 ? 'Great reading! 📚' : 'Story finished!'}
        </h2>
        <p className="py-2 text-lg font-bold text-night-navy/70">
          {firstTryCorrect} of 3 first-try answers
        </p>
        {earned ? (
          <div className="my-3 flex flex-col items-center rounded-2xl bg-sky-bright/10 p-4">
            <div
              className="flex h-28 w-16 items-start justify-center rounded-b-none pt-3 text-3xl shadow-lg"
              style={{
                background: art.gradient,
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)',
              }}
            >
              {art.emoji}
            </div>
            <p className="pt-2 font-display text-xl font-bold text-sky-bright">New bookmark!</p>
            <p className="text-base font-bold text-night-navy/60">{story.bookmarkName}</p>
          </div>
        ) : (
          <p className="pb-2 text-base font-bold text-night-navy/60">
            {completed.includes(story.id)
              ? 'You already own this bookmark — coins earned!'
              : `Get ${BOOKMARK_THRESHOLD} first-try answers to win the bookmark. Read it again — you'll crush it!`}
          </p>
        )}
        <p className="pb-2 font-display text-2xl font-bold text-adventure-gold">🪙 +{coins} coins</p>
        <div className="flex flex-col gap-3 pt-1">
          <Button3D
            color="sky"
            size="lg"
            block
            onTap={() => setMode({ view: 'shelf' })}
            ariaLabel="More stories"
          >
            More Stories ▶
          </Button3D>
          <Button3D color="cream" size="md" block onTap={onExit} ariaLabel="Back to Rome">
            Back to Rome
          </Button3D>
        </div>
      </div>
    </div>
  )
}
