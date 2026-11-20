// Contract only — no implementation, no UI wired to it yet.
//
// Deliberately NOT building FriendActivityWidget / ListeningParty UI
// on top of this in Phase 4: there is no Follow relationship data yet
// (that's Phase 5), so a "friend activity" widget right now could only
// show fabricated names and fabricated "currently listening to X" —
// decorative UI standing in for a feature that doesn't exist. That's
// exactly the kind of fake/demo scaffolding this project's own rules
// rule out. Once Phase 5 (Follow) ships real relationship data, this
// contract is what a realtime layer implements, and only then does a
// widget get built against real data.
//
// Suggested transport when that phase happens: a NestJS WebSocket
// gateway (Socket.io), namespace `/realtime`, events:
//   "friend:activity" -> FriendActivitySnapshot[]  (periodic snapshot)
//   "party:join"       <- { partyId, userId }
//   "party:sync"        -> { songId, positionSeconds, isPlaying }

export interface FriendActivitySnapshot {
  userId: string;
  username: string;
  avatarUrl: string | null;
  currentSongId: string | null;
  currentSongTitle: string | null;
}

export interface RealtimeClient {
  subscribeFriendActivity(
    onUpdate: (activity: FriendActivitySnapshot[]) => void,
  ): () => void;
  joinListeningParty(partyId: string): Promise<void>;
  leaveListeningParty(partyId: string): Promise<void>;
}
