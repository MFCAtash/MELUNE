import { describe, it, expect } from "vitest";
import { decodePalette, encodePalette, hexToRgbTriplet, isCustomThemePalette } from "../custom-theme";

const palette = {
  background: "#06120F",
  surface: "#0C2420",
  foreground: "#ECFFF7",
  brandA: "#3DDC97",
  brandB: "#38BDF8",
};

describe("custom-theme helpers", () => {
  it("converts hex to the project's RGB triplet tokens", () => {
    expect(hexToRgbTriplet("#3DDC97")).toBe("61 220 151");
    expect(hexToRgbTriplet("#fff")).toBe("255 255 255");
  });

  it("round-trips a palette through a URL-safe share code", () => {
    const encoded = encodePalette(palette);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodePalette(encoded)).toEqual(palette);
  });

  it("validates imported palettes and rejects garbage", () => {
    expect(isCustomThemePalette(palette)).toBe(true);
    expect(isCustomThemePalette({ ...palette, brandA: "red" })).toBe(false);
    expect(isCustomThemePalette(null)).toBe(false);
    expect(decodePalette("not-base64!!")).toBeNull();
  });
});
