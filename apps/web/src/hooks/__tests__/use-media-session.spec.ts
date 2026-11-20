import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { useMediaSession } from "../use-media-session";

const TRACK: Song = {
  id: "song-1",
  title: "Midnight Drive",
  slug: "midnight-drive",
  duration: 200,
  audioUrl: "https://example.com/midnight-drive.mp3",
  coverUrl: "https://example.com/cover.jpg",
  playCount: 1,
  artist: { id: "artist-1", name: "Nova Ray", slug: "nova-ray", imageUrl: null },
  album: { id: "album-1", title: "Night Lines", slug: "night-lines", coverUrl: null },
  genre: null,
};

interface FakeMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: Array<{ src: string; sizes: string; type: string }>;
}

class FakeMediaMetadata implements FakeMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: Array<{ src: string; sizes: string; type: string }>;

  constructor(init: FakeMetadata = {}) {
    this.title = init.title;
    this.artist = init.artist;
    this.album = init.album;
    this.artwork = init.artwork;
  }
}

const handlers = new Map<string, ((details?: unknown) => void) | null>();
const setPositionState = vi.fn();

function installMediaSession() {
  const session = {
    metadata: null as FakeMetadata | null,
    playbackState: "none" as "none" | "playing" | "paused",
    setActionHandler: (action: string, handler: ((details?: unknown) => void) | null) => {
      if (handler) handlers.set(action, handler);
      else handlers.delete(action);
    },
    setPositionState,
  };
  Object.defineProperty(navigator, "mediaSession", { value: session, configurable: true });
  vi.stubGlobal("MediaMetadata", FakeMediaMetadata);
  return session;
}

function seedPlayer(overrides: Partial<ReturnType<typeof usePlayerStore.getState>> = {}) {
  usePlayerStore.setState({
    queue: [TRACK],
    originalQueue: [TRACK],
    currentIndex: 0,
    isPlaying: true,
    currentTime: 42,
    duration: 200,
    ...overrides,
  });
}

describe("useMediaSession", () => {
  beforeEach(() => {
    handlers.clear();
    setPositionState.mockClear();
  });

  afterEach(() => {
    // jsdom keeps the property once defined — remove it so other suites
    // in the same file see the "unsupported" path again.
    delete (navigator as unknown as { mediaSession?: unknown }).mediaSession;
    vi.unstubAllGlobals();
    usePlayerStore.setState({ queue: [], currentIndex: 0, isPlaying: false, currentTime: 0, duration: 0 });
  });

  it("publishes the current track's metadata and artwork", () => {
    const session = installMediaSession();
    seedPlayer();

    const { unmount } = renderHook(() => useMediaSession());

    expect(session.metadata?.title).toBe("Midnight Drive");
    expect(session.metadata?.artist).toBe("Nova Ray");
    expect(session.metadata?.album).toBe("Night Lines");
    expect(session.metadata?.artwork?.length).toBeGreaterThan(0);
    expect(session.metadata?.artwork?.[0].src).toBe("https://example.com/cover.jpg");
    unmount();
  });

  it("maps hardware media keys onto the player store", () => {
    installMediaSession();
    seedPlayer();

    const { unmount } = renderHook(() => useMediaSession());

    act(() => handlers.get("play")?.());
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    act(() => handlers.get("nexttrack")?.());
    expect(handlers.has("previoustrack")).toBe(true);

    act(() => handlers.get("seekto")?.({ seekTime: 90 }));
    expect(usePlayerStore.getState().currentTime).toBe(90);
    unmount();
  });

  it("reflects play/pause state and reports a clamped scrubber position", () => {
    const session = installMediaSession();
    seedPlayer();

    const { unmount } = renderHook(() => useMediaSession());
    expect(session.playbackState).toBe("playing");
    expect(setPositionState).toHaveBeenCalledWith({ duration: 200, position: 42, playbackRate: 1 });
    unmount();
  });

  it("is a silent no-op when the platform has no Media Session support", () => {
    seedPlayer();
    expect(() => renderHook(() => useMediaSession()).unmount()).not.toThrow();
  });
});
