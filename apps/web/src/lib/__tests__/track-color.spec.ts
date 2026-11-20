import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearTrackColorCache,
  getCachedTrackColor,
  hashToHsl,
  loadTrackColor,
  trackColorSeed,
} from "../track-color";

beforeEach(() => clearTrackColorCache());
afterEach(() => vi.unstubAllGlobals());

describe("hashToHsl / trackColorSeed", () => {
  it("is deterministic and matches the app-wide seed shape", () => {
    expect(hashToHsl("a-b")).toBe(hashToHsl("a-b"));
    expect(hashToHsl("a-b")).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
    expect(trackColorSeed({ title: "Song", artist: { name: "Nova" } })).toBe("Song-Nova");
  });
});

describe("loadTrackColor", () => {
  it("uses the seed hash when there is no cover, and caches it", async () => {
    expect(getCachedTrackColor(null, "seed")).toBeUndefined();
    const color = await loadTrackColor(null, "seed");
    expect(color).toBe(hashToHsl("seed"));
    expect(getCachedTrackColor(null, "seed")).toBe(color);
  });

  it("falls back to the seed hash when the image can't be read, and shares one load per cover", async () => {
    const created = vi.fn();
    class FailingImage {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        created();
      }
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", FailingImage);

    const [a, b] = await Promise.all([
      loadTrackColor("https://example.com/c.jpg", "seed"),
      loadTrackColor("https://example.com/c.jpg", "seed"),
    ]);
    expect(a).toBe(hashToHsl("seed"));
    expect(b).toBe(a);
    expect(created).toHaveBeenCalledTimes(1);

    // Cached now — no further image load.
    await loadTrackColor("https://example.com/c.jpg", "seed");
    expect(created).toHaveBeenCalledTimes(1);
  });
});
