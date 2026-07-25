import { create } from 'zustand'

/* ---------------------------------------------------------------------------
   V2 MULTIPLAYER STUB — TeamState
   Not wired to any UI yet. Shape is final so v2 can attach a realtime
   backend (WebSocket/Firebase) without a client-side refactor.
   ------------------------------------------------------------------------ */

export interface TeamMember {
  playerId: string
  displayName: string // parent-approved nickname, never free text from kids
  avatarKey: string // picked from a fixed avatar set
  isOnline: boolean
}

interface TeamState {
  teamId: string | null
  teamName: string | null
  teamBadge: string | null // badge asset key, e.g. "badges/lion-shield"
  members: TeamMember[]

  /** v2: replaced by server calls; local no-op setters for now */
  setTeam: (team: {
    teamId: string
    teamName: string
    teamBadge: string
    members: TeamMember[]
  }) => void
  leaveTeam: () => void
}

export const useTeamStore = create<TeamState>()((set) => ({
  teamId: null,
  teamName: null,
  teamBadge: null,
  members: [],

  setTeam: ({ teamId, teamName, teamBadge, members }) =>
    set({ teamId, teamName, teamBadge, members }),

  leaveTeam: () => set({ teamId: null, teamName: null, teamBadge: null, members: [] }),
}))
