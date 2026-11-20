import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBeatPulse } from "../use-beat-pulse";
import { registerPlayerAudioElement } from "@/lib/audio-analyser-bridge";

describe("useBeatPulse", () => {
  // Same reasoning as use-audio-analyser.spec.ts: without a registered
  // element the underlying bridge treats "no analyser" as transient
  // forever rather than permanently unavailable, which would hang these
  // tests waiting for `reactive` to flip.
  beforeEach(() => {
    registerPlayerAudioElement(document.createElement("audio"));
  });

  it("keeps the pulse at 0 and does not throw while not playing", () => {
    const { result, unmount } = renderHook(() => useBeatPulse(false));
    expect(result.current.pulseRef.current).toBe(0);
    expect(result.current.bpm).toBeNull();
    unmount();
  });

  it("falls back to reactive=false (no Web Audio in jsdom) and keeps bpm null", async () => {
    const { result, unmount } = renderHook(() => useBeatPulse(true));
    await waitFor(() => expect(result.current.reactive).toBe(false));
    expect(result.current.bpm).toBeNull();
    unmount();
  });

  it("cleans up its animation frame loop on unmount without throwing", () => {
    const { unmount } = renderHook(() => useBeatPulse(true));
    expect(() => unmount()).not.toThrow();
  });

  it("resets the pulse to 0 when playback stops", () => {
    const { result, rerender, unmount } = renderHook(({ isPlaying }) => useBeatPulse(isPlaying), {
      initialProps: { isPlaying: true },
    });
    rerender({ isPlaying: false });
    expect(result.current.pulseRef.current).toBe(0);
    unmount();
  });
});
