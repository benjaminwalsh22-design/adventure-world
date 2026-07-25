import { create } from 'zustand'

/* ---------------------------------------------------------------------------
   V2 MULTIPLAYER STUB — ChatState
   COPPA-aligned by construction: there is NO free-text input anywhere.
   Kids can only send messages chosen from QUICK_CHAT_PHRASES, keyed by id.
   The message payload stores the phrase id — the client renders the phrase
   from its own table, so nothing user-authored ever crosses the wire.
   ------------------------------------------------------------------------ */

export const QUICK_CHAT_PHRASES = {
  great_job: 'Great job! 🎉',
  lets_play_rome: "Let's play Rome!",
  new_sticker: 'Check out my new sticker!',
  good_luck: 'Good luck!',
  that_was_fun: 'That was fun!',
  race_me: 'Race me in the pool!',
  wow: 'Wow!!',
  high_five: 'High five! ✋',
} as const

export type QuickChatPhraseId = keyof typeof QUICK_CHAT_PHRASES

export interface ChatMessage {
  id: string
  senderId: string
  phraseId: QuickChatPhraseId // ONLY predefined phrases — no open text
  sentAt: number
}

interface ChatState {
  messages: ChatMessage[]
  /** v2: will publish to the team channel; local echo only for now */
  sendPhrase: (senderId: string, phraseId: QuickChatPhraseId) => void
  clear: () => void
}

let msgCounter = 0

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],

  sendPhrase: (senderId, phraseId) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `msg_${Date.now().toString(36)}_${(msgCounter++).toString(36)}`,
          senderId,
          phraseId,
          sentAt: Date.now(),
        },
      ].slice(-100), // ring buffer — chat history is ephemeral by design
    })),

  clear: () => set({ messages: [] }),
}))
