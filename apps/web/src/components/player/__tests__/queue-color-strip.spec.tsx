import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Song } from "@codex-music/types";
import { usePlayerStore } from "@/store/player-store";
import { useAmbientThemeStore } from "@/store/ambient-theme-store";
import { clearTrackColorCache } from "@/lib/track-color";
import { QueueColorStrip } from "../queue-color-strip";

function song(n: number): Song {
  return {
    id: `s${n}`,
    title: `Song ${n}`,
    slug: `song-${n}`,
    duration: 200,
    audioUrl: `https://example.com/${n}.mp3`,
    coverUrl: null,
    playCount: 0,
    artist: { id: "a", name: "Artist", slug: "artist", imageUrl: null },
    album: null,
    genre: null,
  };
}

function setQueue(length: number, currentIndex: number, extra: Partial<{ currentTime: number; duration: number }> = {}) {
  const queue = Array.from({ length }, (_, i) => song(i));
  usePlayerStore.setState({
    queue,
    originalQueue: queue,
    currentIndex,
    currentTime: extra.currentTime ?? 0,
    duration: extra.duration ?? 200,
  });
}

const segments = (state: string) =>
  screen.getByTestId("queue-color-strip").querySelectorAll(`[data-segment="${state}"]`);

beforeEach(() => {
  clearTrackColorCache();
  useAmbientThemeStore.setState({ mode: "dynamic" });
});

describe("QueueColorStrip", () => {
  it("renders nothing when no track is queued after the current one", () => {
    setQueue(1, 0);
    const { container } = render(<QueueColorStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty queue", () => {
    usePlayerStore.setState({ queue: [], originalQueue: [], currentIndex: -1 });
    const { container } = render(<QueueColorStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows played, current and upcoming segments with an accessible label", () => {
    setQueue(5, 2);
    render(<QueueColorStrip />);

    expect(screen.getByRole("img", { name: "Color preview of upcoming tracks" })).toBeInTheDocument();
    expect(segments("played")).toHaveLength(2);
    expect(segments("current")).toHaveLength(1);
    expect(segments("upcoming")).toHaveLength(2);
    expect(segments("more")).toHaveLength(0);
  });

  it("adds a trailing cap when more tracks are queued than the window shows", () => {
    setQueue(30, 0);
    render(<QueueColorStrip />);
    expect(segments("upcoming")).toHaveLength(8);
    expect(segments("more")).toHaveLength(1);
  });

  it("fills the current segment with playback progress", () => {
    setQueue(3, 0, { currentTime: 50, duration: 200 });
    render(<QueueColorStrip />);
    const fill = segments("current")[0].firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("25%");
  });

  it("uses the brand color for every segment when ambient tinting is static", () => {
    useAmbientThemeStore.setState({ mode: "static" });
    setQueue(3, 0);
    render(<QueueColorStrip />);
    for (const el of Array.from(segments("upcoming"))) {
      expect(el).toHaveStyle({ backgroundColor: "#8B5CF6" });
    }
  });
});
