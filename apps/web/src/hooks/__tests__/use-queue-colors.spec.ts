import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Song } from "@melune/types";
import { useQueueColors } from "../use-queue-colors";
import { useAmbientThemeStore } from "@/store/ambient-theme-store";
import { clearTrackColorCache } from "@/lib/track-color";
import { BRAND_STATIC_COLOR } from "@/lib/ambient-color-utils";

function song(title: string): Song {
  return {
    id: title,
    title,
    slug: title,
    duration: 200,
    audioUrl: "https://example.com/a.mp3",
    coverUrl: null,
    playCount: 0,
    artist: { id: "a", name: "Artist", slug: "artist", imageUrl: null },
    album: null,
    genre: null,
  };
}

beforeEach(() => {
  clearTrackColorCache();
  useAmbientThemeStore.setState({ mode: "dynamic" });
});

describe("useQueueColors", () => {
  it("returns one clamped color per track, in order, stable per song", async () => {
    const tracks = [song("Alpha"), song("Zzzzzzz Totally Different")];
    const { result } = renderHook(() => useQueueColors(tracks));

    expect(result.current).toHaveLength(2);
    for (const color of result.current) expect(color).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
    expect(result.current[0]).not.toBe(result.current[1]);

    const first = result.current[0];
    await waitFor(() => expect(result.current[0]).toBe(first));
  });

  it("pins every segment to the brand color in static mode", () => {
    useAmbientThemeStore.setState({ mode: "static" });
    const { result } = renderHook(() => useQueueColors([song("A"), song("B")]));
    expect(result.current).toEqual([BRAND_STATIC_COLOR, BRAND_STATIC_COLOR]);
  });

  it("returns an empty list for no tracks", () => {
    const { result } = renderHook(() => useQueueColors([]));
    expect(result.current).toEqual([]);
  });
});
