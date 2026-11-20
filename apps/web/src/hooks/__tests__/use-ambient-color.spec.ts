import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAmbientColor } from "../use-ambient-color";

describe("useAmbientColor", () => {
  it("returns a deterministic color for the same seed with no coverUrl", () => {
    const { result: a } = renderHook(() => useAmbientColor(null, "Song Title-Artist Name"));
    const { result: b } = renderHook(() => useAmbientColor(null, "Song Title-Artist Name"));
    expect(a.current).toBe(b.current);
    expect(a.current).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
  });

  it("returns different colors for different seeds (not guaranteed but true for these picks)", () => {
    const { result: a } = renderHook(() => useAmbientColor(null, "Alpha"));
    const { result: b } = renderHook(() => useAmbientColor(null, "Zzzzzzz Totally Different"));
    expect(a.current).not.toBe(b.current);
  });

  it("does not throw when coverUrl is undefined", () => {
    expect(() => renderHook(() => useAmbientColor(undefined, "seed"))).not.toThrow();
  });
});
