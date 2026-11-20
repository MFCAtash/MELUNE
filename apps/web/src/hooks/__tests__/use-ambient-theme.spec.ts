import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAmbientTheme } from "../use-ambient-theme";
import { useAmbientThemeStore } from "@/store/ambient-theme-store";

describe("useAmbientTheme", () => {
  beforeEach(() => {
    useAmbientThemeStore.setState({ mode: "dynamic" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dynamic mode returns a contrast-safety-clamped version of the extracted color", () => {
    // No coverUrl → useAmbientColor falls back to its deterministic
    // hash-based hsl(), always already within the safe band, so this
    // mainly asserts the pipeline runs end-to-end without altering hue.
    const { result } = renderHook(() => useAmbientTheme(null, "some-track-seed"));
    expect(result.current.mode).toBe("dynamic");
    expect(result.current.color.startsWith("hsl(")).toBe(true);
  });

  it("static mode pins the exact brand color, unmodified by the safety clamp", () => {
    useAmbientThemeStore.setState({ mode: "static" });
    const { result } = renderHook(() => useAmbientTheme(null, "some-track-seed"));
    expect(result.current.color).toBe("#8B5CF6");
  });

  it("system mode behaves like dynamic when the OS has no elevated-contrast preference", () => {
    useAmbientThemeStore.setState({ mode: "system" });
    const { result } = renderHook(() => useAmbientTheme(null, "some-track-seed"));
    expect(result.current.color.startsWith("hsl(")).toBe(true);
  });

  it("system mode pins the brand color when the OS reports prefers-contrast: more", () => {
    useAmbientThemeStore.setState({ mode: "system" });
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-contrast"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })),
    );

    const { result } = renderHook(() => useAmbientTheme(null, "some-track-seed"));
    expect(result.current.color).toBe("#8B5CF6");
  });

  it("amoled mode pins the exact brand color too, same as static", () => {
    useAmbientThemeStore.setState({ mode: "amoled" });
    const { result } = renderHook(() => useAmbientTheme(null, "some-track-seed"));
    expect(result.current.color).toBe("#8B5CF6");
    expect(result.current.mode).toBe("amoled");
  });
});
