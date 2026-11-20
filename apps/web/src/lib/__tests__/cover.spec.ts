import { describe, it, expect } from "vitest";
import { coverGradient, coverPalette, hashString, initialOf } from "../cover";

describe("cover helpers", () => {
  it("is deterministic for the same seed", () => {
    expect(coverGradient("Midnight City")).toBe(coverGradient("Midnight City"));
    expect(hashString("abc")).toBe(hashString("abc"));
  });

  it("always returns a palette pair of hex colours", () => {
    for (const seed of ["", "a", "Blinding Lights", "شب بخیر", "x".repeat(500)]) {
      const [from, to] = coverPalette(seed);
      expect(from).toMatch(/^#[0-9A-F]{6}$/i);
      expect(to).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("spreads different titles across more than one palette", () => {
    const seen = new Set(
      ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"].map(
        (t) => coverPalette(t).join(),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("derives an initial, with a fallback for empty titles", () => {
    expect(initialOf("  night drive")).toBe("N");
    expect(initialOf("")).toBe("♪");
  });
});
