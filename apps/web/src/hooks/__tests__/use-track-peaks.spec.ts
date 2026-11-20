import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTrackPeaks } from "../use-track-peaks";

describe("useTrackPeaks", () => {
  it("returns null for a null source", () => {
    const { result, unmount } = renderHook(() => useTrackPeaks(null));
    expect(result.current).toBeNull();
    unmount();
  });

  it("degrades to null when Web Audio is unavailable (jsdom) instead of throwing", async () => {
    const { result, unmount } = renderHook(() => useTrackPeaks("https://example.com/track.mp3"));
    // No AudioContext in jsdom → the decode path bails immediately and
    // the seek bar keeps its plain look.
    expect(result.current).toBeNull();
    expect(() => unmount()).not.toThrow();
  });
});
