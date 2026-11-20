import { describe, it, expect, beforeEach } from "vitest";
import type { Song } from "@codex-music/types";
import { usePlayerStore } from "../player-store";

function makeTrack(id: string, title: string): Song {
  return {
    id,
    title,
    slug: title.toLowerCase().replace(/\s+/g, "-"),
    duration: 200,
    audioUrl: `https://example.com/${id}.mp3`,
    coverUrl: null,
    playCount: 0,
    artist: { id: "artist-1", name: "Test Artist", slug: "test-artist", imageUrl: null },
    album: null,
    genre: null,
  };
}

const tracks = [makeTrack("1", "One"), makeTrack("2", "Two"), makeTrack("3", "Three")];

describe("player-store", () => {
  beforeEach(() => {
    usePlayerStore.setState({
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
    });
  });

  it("playQueue sets the queue and starts playing at the given index", () => {
    usePlayerStore.getState().playQueue(tracks, 1);
    const state = usePlayerStore.getState();
    expect(state.queue).toHaveLength(3);
    expect(state.currentIndex).toBe(1);
    expect(state.isPlaying).toBe(true);
    expect(state.currentTrack()?.id).toBe("2");
  });

  it("togglePlay flips isPlaying only when a queue exists", () => {
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false); // no-op, empty queue

    usePlayerStore.getState().playQueue(tracks, 0);
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("next() advances through the queue and stops after the last track (repeat=off)", () => {
    usePlayerStore.getState().playQueue(tracks, 0);
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().currentIndex).toBe(1);
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().currentIndex).toBe(2);
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().currentIndex).toBe(2); // stayed
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("next() wraps to the start when repeat=all", () => {
    usePlayerStore.getState().playQueue(tracks, 2);
    usePlayerStore.setState({ repeat: "all" });
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().currentIndex).toBe(0);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("previous() restarts the current track instead of going back when past 3s", () => {
    usePlayerStore.getState().playQueue(tracks, 1);
    usePlayerStore.setState({ currentTime: 10 });
    usePlayerStore.getState().previous();
    expect(usePlayerStore.getState().currentIndex).toBe(1);
    expect(usePlayerStore.getState().currentTime).toBe(0);
  });

  it("previous() goes to the prior track when within the first 3s", () => {
    usePlayerStore.getState().playQueue(tracks, 1);
    usePlayerStore.setState({ currentTime: 1 });
    usePlayerStore.getState().previous();
    expect(usePlayerStore.getState().currentIndex).toBe(0);
  });

  it("toggleShuffle reshuffles the queue but keeps the current track playing", () => {
    usePlayerStore.getState().playQueue(tracks, 1); // currently "Two"
    usePlayerStore.getState().toggleShuffle();
    const state = usePlayerStore.getState();
    expect(state.shuffle).toBe(true);
    expect(state.currentTrack()?.id).toBe("2");

    usePlayerStore.getState().toggleShuffle();
    const restored = usePlayerStore.getState();
    expect(restored.shuffle).toBe(false);
    expect(restored.queue.map((t) => t.id)).toEqual(["1", "2", "3"]);
    expect(restored.currentTrack()?.id).toBe("2");
  });

  it("cycleRepeat rotates off -> all -> one -> off", () => {
    expect(usePlayerStore.getState().repeat).toBe("off");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("all");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("one");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("off");
  });

  it("onTrackEnded restarts the same track when repeat=one", () => {
    usePlayerStore.getState().playQueue(tracks, 0);
    usePlayerStore.setState({ repeat: "one", currentTime: 200 });
    usePlayerStore.getState().onTrackEnded();
    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(0);
    expect(state.currentTime).toBe(0);
    expect(state.isPlaying).toBe(true);
  });

  it("onTrackEnded advances to the next track when repeat=off", () => {
    usePlayerStore.getState().playQueue(tracks, 0);
    usePlayerStore.getState().onTrackEnded();
    expect(usePlayerStore.getState().currentIndex).toBe(1);
  });

  it("setVolume(0) implies muted", () => {
    usePlayerStore.getState().setVolume(0);
    expect(usePlayerStore.getState().muted).toBe(true);
  });

  describe("editable queue", () => {
    it("removeFromQueue before the current track shifts the pointer back", () => {
      usePlayerStore.getState().playQueue(tracks, 1); // playing "Two"
      usePlayerStore.getState().removeFromQueue(0); // removes "One"
      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual(["2", "3"]);
      expect(state.currentIndex).toBe(0);
      expect(state.currentTrack()?.id).toBe("2");
    });

    it("removeFromQueue on the currently playing track lets the next one slide in and keeps playing", () => {
      usePlayerStore.getState().playQueue(tracks, 0); // playing "One"
      usePlayerStore.getState().removeFromQueue(0);
      const state = usePlayerStore.getState();
      expect(state.currentIndex).toBe(0);
      expect(state.currentTrack()?.id).toBe("2");
      expect(state.isPlaying).toBe(true);
    });

    it("removeFromQueue on the last, currently playing track stops instead of jumping backwards", () => {
      usePlayerStore.getState().playQueue(tracks, 2); // playing "Three"
      usePlayerStore.getState().removeFromQueue(2);
      const state = usePlayerStore.getState();
      expect(state.currentIndex).toBe(1);
      expect(state.currentTrack()?.id).toBe("2");
      expect(state.isPlaying).toBe(false);
    });

    it("removeFromQueue after the current track leaves playback untouched", () => {
      usePlayerStore.getState().playQueue(tracks, 0);
      usePlayerStore.getState().removeFromQueue(2);
      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual(["1", "2"]);
      expect(state.currentIndex).toBe(0);
      expect(state.isPlaying).toBe(true);
    });

    it("removeFromQueue clears playback once the queue empties out", () => {
      usePlayerStore.getState().playQueue([tracks[0]], 0);
      usePlayerStore.getState().removeFromQueue(0);
      const state = usePlayerStore.getState();
      expect(state.queue).toHaveLength(0);
      expect(state.currentIndex).toBe(-1);
      expect(state.isPlaying).toBe(false);
    });

    it("moveInQueue reorders the queue and follows the currently playing track", () => {
      usePlayerStore.getState().playQueue(tracks, 0); // playing "One"
      usePlayerStore.getState().moveInQueue(0, 2); // "One" -> last
      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual(["2", "3", "1"]);
      expect(state.currentIndex).toBe(2);
      expect(state.currentTrack()?.id).toBe("1");
    });

    it("moveInQueue keeps the pointer correct when a track moves across the current track", () => {
      usePlayerStore.getState().playQueue(tracks, 1); // playing "Two"
      usePlayerStore.getState().moveInQueue(2, 0); // "Three" moves before "Two"
      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual(["3", "1", "2"]);
      expect(state.currentIndex).toBe(2);
      expect(state.currentTrack()?.id).toBe("2");
    });

    it("addToQueue('next') inserts right after the current track", () => {
      usePlayerStore.getState().playQueue([tracks[0], tracks[1]], 0);
      usePlayerStore.getState().addToQueue(tracks[2], "next");
      expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(["1", "3", "2"]);
    });

    it("addToQueue('end') appends to the end of the queue", () => {
      usePlayerStore.getState().playQueue([tracks[0]], 0);
      usePlayerStore.getState().addToQueue(tracks[1]);
      usePlayerStore.getState().addToQueue(tracks[2]);
      expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(["1", "2", "3"]);
    });

    it("addToQueue on an empty queue starts playing that track", () => {
      usePlayerStore.getState().addToQueue(tracks[0]);
      const state = usePlayerStore.getState();
      expect(state.currentTrack()?.id).toBe("1");
      expect(state.isPlaying).toBe(true);
    });

    it("clearUpcoming drops everything after the current track", () => {
      usePlayerStore.getState().playQueue(tracks, 1); // playing "Two"
      usePlayerStore.getState().clearUpcoming();
      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual(["1", "2"]);
      expect(state.currentIndex).toBe(1);
      expect(state.currentTrack()?.id).toBe("2");
    });
  });
});
