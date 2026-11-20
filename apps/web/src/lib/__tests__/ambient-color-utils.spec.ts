import { describe, it, expect } from "vitest";
import { parseColor } from "../color";
import { BRAND_STATIC_COLOR, resolveAmbientColor, toSafeAmbientColor } from "../ambient-color-utils";

describe("toSafeAmbientColor", () => {
  it("clamps a near-white extraction (very high lightness) into the safe band", () => {
    const result = toSafeAmbientColor("rgb(250, 248, 252)");
    const parsed = parseColor(result)!;
    expect(parsed.l).toBeLessThanOrEqual(62);
  });

  it("clamps a near-black extraction (very low lightness) into the safe band", () => {
    const result = toSafeAmbientColor("rgb(8, 6, 10)");
    const parsed = parseColor(result)!;
    expect(parsed.l).toBeGreaterThanOrEqual(32);
  });

  it("clamps a washed-out, low-saturation extraction up into the safe band", () => {
    const result = toSafeAmbientColor("rgb(140, 138, 142)"); // near-gray
    const parsed = parseColor(result)!;
    expect(parsed.s).toBeGreaterThanOrEqual(42);
  });

  it("leaves an already-safe color's hue untouched", () => {
    // hsl(258, 70%, 55%) — within band on s/l already, hue must survive exactly.
    const result = toSafeAmbientColor("hsl(258, 70%, 55%)");
    const parsed = parseColor(result)!;
    expect(Math.round(parsed.h)).toBe(258);
    expect(Math.round(parsed.s)).toBe(70);
    expect(Math.round(parsed.l)).toBe(55);
  });

  it("fails open — returns the input unchanged for an unparseable color", () => {
    expect(toSafeAmbientColor("currentColor")).toBe("currentColor");
    expect(toSafeAmbientColor("var(--some-token)")).toBe("var(--some-token)");
  });

  it("preserves alpha, reserializing as rgba when the input had one", () => {
    const result = toSafeAmbientColor("rgba(250, 248, 252, 0.4)");
    expect(result.startsWith("rgba(")).toBe(true);
    expect(result.endsWith("0.4)")).toBe(true);
  });
});

describe("resolveAmbientColor", () => {
  const raw = "hsl(200, 70%, 55%)";

  it("clamps the raw color in dynamic mode", () => {
    expect(resolveAmbientColor(raw, "dynamic", false)).toBe(toSafeAmbientColor(raw));
  });

  it("pins the brand color for static and amoled", () => {
    expect(resolveAmbientColor(raw, "static", false)).toBe(BRAND_STATIC_COLOR);
    expect(resolveAmbientColor(raw, "amoled", false)).toBe(BRAND_STATIC_COLOR);
  });

  it("pins the brand color for system only under prefers-contrast: more", () => {
    expect(resolveAmbientColor(raw, "system", true)).toBe(BRAND_STATIC_COLOR);
    expect(resolveAmbientColor(raw, "system", false)).toBe(toSafeAmbientColor(raw));
  });
});
