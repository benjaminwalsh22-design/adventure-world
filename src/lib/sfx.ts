/**
 * Zero-asset sound effects, synthesized with the Web Audio API.
 *
 * Why synthesis instead of mp3/wav assets:
 *  - no network fetches, instant playback (critical for tap feedback)
 *  - iOS Safari unlocks the AudioContext on the first user gesture; we
 *    lazily resume it inside every play() call so the first real tap works.
 *
 * All playback respects the SFX toggle in the settings overlay.
 */

import { useSettingsStore } from '../state/useSettingsStore'

export type SfxName =
  | 'tap' // generic button press
  | 'pop' // pin tap / card flip
  | 'whoosh' // camera zoom to a city
  | 'success' // correct answer / match found
  | 'magnet' // puzzle piece snap
  | 'reward' // medal / sticker / bookmark earned
  | 'error' // gentle "try again" (never harsh for kids)

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') {
    // Must be called from a user gesture on iOS — play() is always
    // invoked from touch handlers, so this resumes on first tap.
    void ctx.resume()
  }
  return ctx
}

function tone(
  ac: AudioContext,
  {
    freq,
    endFreq,
    type = 'sine',
    duration = 0.12,
    gain = 0.15,
    delay = 0,
  }: {
    freq: number
    endFreq?: number
    type?: OscillatorType
    duration?: number
    gain?: number
    delay?: number
  },
): void {
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration)
  amp.gain.setValueAtTime(0, t0)
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(amp).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

const RECIPES: Record<SfxName, (ac: AudioContext) => void> = {
  tap: (ac) => tone(ac, { freq: 480, endFreq: 620, type: 'triangle', duration: 0.08, gain: 0.12 }),
  pop: (ac) => tone(ac, { freq: 300, endFreq: 900, type: 'sine', duration: 0.1, gain: 0.18 }),
  whoosh: (ac) =>
    tone(ac, { freq: 220, endFreq: 1400, type: 'sawtooth', duration: 0.5, gain: 0.06 }),
  success: (ac) => {
    tone(ac, { freq: 523.25, duration: 0.12, gain: 0.14 }) // C5
    tone(ac, { freq: 659.25, duration: 0.12, gain: 0.14, delay: 0.09 }) // E5
    tone(ac, { freq: 783.99, duration: 0.2, gain: 0.16, delay: 0.18 }) // G5
  },
  magnet: (ac) => tone(ac, { freq: 900, endFreq: 300, type: 'square', duration: 0.09, gain: 0.08 }),
  reward: (ac) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(ac, { freq: f, duration: 0.16, gain: 0.15, delay: i * 0.1 }),
    )
  },
  error: (ac) => tone(ac, { freq: 330, endFreq: 240, type: 'sine', duration: 0.18, gain: 0.1 }),
}

export function playSfx(name: SfxName): void {
  if (!useSettingsStore.getState().sfxEnabled) return
  const ac = getCtx()
  if (!ac) return
  try {
    RECIPES[name](ac)
  } catch {
    /* audio must never break gameplay */
  }
}
