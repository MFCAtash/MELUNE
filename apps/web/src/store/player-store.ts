import { create } from "zustand";
import type { Song } from "@melune/types";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Song[];
  originalQueue: Song[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0..1
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Bumped on every explicit seek so the audio engine knows to apply
   *  currentTime to the <audio> element (vs. just recording playback
   *  progress reported by timeupdate). */
  seekVersion: number;
  /** Sleep timer (Phase 12): epoch ms when playback should pause, or
   *  null when no timer is set. Driven by PlayerEngine's 1s heartbeat. */
  sleepAt: number | null;
  /** "End of track" sleep mode: the track id after which playback stops
   *  instead of advancing. Checked in onTrackEnded. */
  sleepAfterTrackId: string | null;

  currentTrack: () => Song | null;

  playQueue: (tracks: Song[], startIndex?: number) => void;
  playTrack: (track: Song) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  /** Called by the audio engine when a track ends, to honor repeat/shuffle/advance. */
  onTrackEnded: () => void;

  // ---- Sleep timer (Phase 12) ----
  /** mode: "off" clears any timer; "minutes" pauses after N minutes;
   *  "track" pauses after the currently playing track ends. */
  setSleepTimer: (mode: { type: "off" } | { type: "minutes"; minutes: number } | { type: "track" }) => void;
  /** Pauses playback and clears the timer — called by the engine's
   *  heartbeat when `sleepAt` elapses, or by onTrackEnded for the
   *  "end of track" mode. */
  fireSleepTimer: () => void;

  // ---- Editable queue (Phase 5.2) ----
  /** Removes the track at `index` from the live queue. Handles every
   *  position relative to the currently playing track: before it (shifts
   *  the pointer back), the current one (the next track slides into its
   *  slot and keeps playing), or after it (no-op on playback state). */
  removeFromQueue: (index: number) => void;
  /** Reorders the live queue, moving the track at `from` to `to`. */
  moveInQueue: (from: number, to: number) => void;
  /** Inserts `track` either right after the current track ("next") or at
   *  the end of the queue ("end", the default). Starts playback if the
   *  queue was empty. */
  addToQueue: (track: Song, position?: "next" | "end") => void;
  /** Drops every track after the one currently playing, leaving playback
   *  untouched. A no-op with an empty queue. */
  clearUpcoming: () => void;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  originalQueue: [],
  currentIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off",
  seekVersion: 0,
  sleepAt: null,
  sleepAfterTrackId: null,

  currentTrack: () => {
    const { queue, currentIndex } = get();
    return queue[currentIndex] ?? null;
  },

  playQueue: (tracks, startIndex = 0) => {
    if (tracks.length === 0) return;
    const { shuffle } = get();
    const originalQueue = tracks;
    const queue = shuffle ? shuffleArray(tracks) : tracks;
    const startTrack = tracks[startIndex];
    const resolvedIndex = shuffle
      ? queue.findIndex((t) => t.id === startTrack.id)
      : startIndex;

    set({
      originalQueue,
      queue,
      currentIndex: resolvedIndex < 0 ? 0 : resolvedIndex,
      isPlaying: true,
      currentTime: 0,
    });
  },

  playTrack: (track) => {
    get().playQueue([track], 0);
  },

  togglePlay: () => {
    if (get().queue.length === 0) return;
    set((s) => ({ isPlaying: !s.isPlaying }));
  },

  pause: () => set({ isPlaying: false }),

  next: () => {
    const { queue, currentIndex, repeat } = get();
    if (queue.length === 0) return;

    if (currentIndex >= queue.length - 1) {
      if (repeat === "all") {
        set({ currentIndex: 0, currentTime: 0, isPlaying: true });
      } else {
        set({ isPlaying: false });
      }
      return;
    }

    set({ currentIndex: currentIndex + 1, currentTime: 0, isPlaying: true });
  },

  previous: () => {
    const { queue, currentIndex, currentTime } = get();
    if (queue.length === 0) return;

    // Scrubbed-in-enough restart-current-track behavior, like every
    // real player: "previous" within the first 3s goes back a track,
    // otherwise it restarts the current one.
    if (currentTime > 3 || currentIndex === 0) {
      set((s) => ({ currentTime: 0, seekVersion: s.seekVersion + 1 }));
      return;
    }

    set({ currentIndex: currentIndex - 1, currentTime: 0, isPlaying: true });
  },

  seek: (time) => set((s) => ({ currentTime: time, seekVersion: s.seekVersion + 1 })),

  setVolume: (volume) => set({ volume, muted: volume === 0 }),

  toggleMute: () => set((s) => ({ muted: !s.muted })),

  toggleShuffle: () => {
    const { shuffle, originalQueue, queue, currentIndex } = get();
    const currentId = queue[currentIndex]?.id;

    if (!shuffle) {
      const shuffled = shuffleArray(originalQueue);
      const newIndex = shuffled.findIndex((t) => t.id === currentId);
      set({ shuffle: true, queue: shuffled, currentIndex: newIndex < 0 ? 0 : newIndex });
    } else {
      const newIndex = originalQueue.findIndex((t) => t.id === currentId);
      set({ shuffle: false, queue: originalQueue, currentIndex: newIndex < 0 ? 0 : newIndex });
    }
  },

  cycleRepeat: () => {
    const order: RepeatMode[] = ["off", "all", "one"];
    const next = order[(order.indexOf(get().repeat) + 1) % order.length];
    set({ repeat: next });
  },

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),

  onTrackEnded: () => {
    const { repeat, sleepAfterTrackId, queue, currentIndex } = get();
    // "End of track" sleep mode: stop instead of advancing once the
    // track the timer was armed on finishes.
    if (sleepAfterTrackId && sleepAfterTrackId === queue[currentIndex]?.id) {
      set({ isPlaying: false, sleepAt: null, sleepAfterTrackId: null });
      return;
    }
    if (repeat === "one") {
      set((s) => ({ currentTime: 0, seekVersion: s.seekVersion + 1, isPlaying: true }));
      return;
    }
    get().next();
  },

  setSleepTimer: (mode) => {
    if (mode.type === "off") {
      set({ sleepAt: null, sleepAfterTrackId: null });
      return;
    }
    if (mode.type === "track") {
      const { queue, currentIndex } = get();
      set({ sleepAt: null, sleepAfterTrackId: queue[currentIndex]?.id ?? null });
      return;
    }
    set({ sleepAt: Date.now() + mode.minutes * 60_000, sleepAfterTrackId: null });
  },

  fireSleepTimer: () => set({ isPlaying: false, sleepAt: null, sleepAfterTrackId: null }),

  removeFromQueue: (index) => {
    const { queue, originalQueue, currentIndex } = get();
    if (index < 0 || index >= queue.length) return;

    const removed = queue[index];
    const newQueue = [...queue.slice(0, index), ...queue.slice(index + 1)];
    // Same-reference removal keeps this correct even when shuffled — see
    // playQueue: `queue` and `originalQueue` share the same Song objects.
    const newOriginal = originalQueue.filter((t) => t !== removed);

    if (newQueue.length === 0) {
      set({ queue: newQueue, originalQueue: newOriginal, currentIndex: -1, isPlaying: false });
      return;
    }

    if (index < currentIndex) {
      set({ queue: newQueue, originalQueue: newOriginal, currentIndex: currentIndex - 1 });
      return;
    }

    if (index === currentIndex) {
      // The next track slides into this slot and keeps playing; if the
      // removed track was last, step back one and stop rather than
      // surprise-playing whatever now sits there.
      const stillHasNext = index < newQueue.length;
      set({
        queue: newQueue,
        originalQueue: newOriginal,
        currentIndex: stillHasNext ? index : newQueue.length - 1,
        currentTime: 0,
        isPlaying: stillHasNext && get().isPlaying,
      });
      return;
    }

    // Removed an upcoming track after the current one — playback unaffected.
    set({ queue: newQueue, originalQueue: newOriginal });
  },

  moveInQueue: (from, to) => {
    const { queue, originalQueue, currentIndex, shuffle } = get();
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;

    const newQueue = [...queue];
    const [moved] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, moved);

    // Reordering only carries over to the unshuffled order when we aren't
    // shuffled — while shuffled, "original order" intentionally stays what
    // it was, exactly like toggling shuffle off restores the queued order.
    let newOriginal = originalQueue;
    if (!shuffle) {
      newOriginal = [...originalQueue];
      const [origMoved] = newOriginal.splice(from, 1);
      newOriginal.splice(to, 0, origMoved);
    }

    let newIndex = currentIndex;
    if (currentIndex === from) {
      newIndex = to;
    } else if (from < currentIndex && to >= currentIndex) {
      newIndex = currentIndex - 1;
    } else if (from > currentIndex && to <= currentIndex) {
      newIndex = currentIndex + 1;
    }

    set({ queue: newQueue, originalQueue: newOriginal, currentIndex: newIndex });
  },

  addToQueue: (track, position = "end") => {
    const { queue, originalQueue, currentIndex, shuffle } = get();

    if (queue.length === 0 || currentIndex < 0) {
      get().playQueue([track], 0);
      return;
    }

    const insertAt = position === "next" ? currentIndex + 1 : queue.length;
    const newQueue = [...queue.slice(0, insertAt), track, ...queue.slice(insertAt)];

    // Mirror the same relative position into the unshuffled order when we
    // aren't shuffled; while shuffled just append, since there's no
    // meaningful "next" position in an order the user can't see.
    const originalInsertAt = shuffle ? originalQueue.length : insertAt;
    const newOriginal = [
      ...originalQueue.slice(0, originalInsertAt),
      track,
      ...originalQueue.slice(originalInsertAt),
    ];

    set({ queue: newQueue, originalQueue: newOriginal });
  },

  clearUpcoming: () => {
    const { queue, originalQueue, currentIndex } = get();
    if (currentIndex < 0) {
      set({ queue: [], originalQueue: [] });
      return;
    }
    const newQueue = queue.slice(0, currentIndex + 1);
    set({ queue: newQueue, originalQueue: originalQueue.filter((t) => newQueue.includes(t)) });
  },
}));
