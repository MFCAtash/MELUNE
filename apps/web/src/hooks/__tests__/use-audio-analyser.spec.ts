import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAudioAnalyser } from "../use-audio-analyser";
import { registerPlayerAudioElement } from "@/lib/audio-analyser-bridge";

describe("useAudioAnalyser", () => {
  // Mirrors what PlayerEngine does on mount in the real app — without
  // this, the bridge has no element to build a graph from and (by
  // design) treats that as "not ready yet" forever rather than
  // "permanently unavailable", which would hang these tests.
  beforeEach(() => {
    registerPlayerAudioElement(document.createElement("audio"));
  });

  it("does not throw and returns zeroed levels when isPlaying is false", () => {
    const { result, unmount } = renderHook(() => useAudioAnalyser(false));
    expect(result.current.levelsRef.current).toEqual({ bass: 0, mid: 0, treble: 0, overall: 0 });
    expect(result.current.reactive).toBe(true);
    unmount();
  });

  it("falls back to reactive=false when Web Audio isn't available (jsdom) even while isPlaying is true", async () => {
    const { result, unmount } = renderHook(() => useAudioAnalyser(true));
    // jsdom has no AudioContext, so the bridge reports permanent
    // unavailability on the very first polled frame — no need to wait
    // out the ~1.5s silent-frames threshold used for the CORS-taint case.
    await waitFor(() => expect(result.current.reactive).toBe(false));
    unmount();
  });

  it("cleans up its animation frame loop on unmount without throwing", () => {
    const { unmount } = renderHook(() => useAudioAnalyser(true));
    expect(() => unmount()).not.toThrow();
  });
});
