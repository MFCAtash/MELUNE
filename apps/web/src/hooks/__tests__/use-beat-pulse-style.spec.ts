import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useBeatPulseStyle } from "../use-beat-pulse-style";

describe("useBeatPulseStyle", () => {
  it("resets to pulse=0 once when disabled, without starting an animation frame loop", () => {
    const apply = vi.fn();
    const el = document.createElement("div");

    renderHook(() => {
      const elementRef = useRef<HTMLElement>(el);
      const pulseRef = useRef(0.7);
      useBeatPulseStyle(pulseRef, elementRef, apply, false);
    });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(el, 0);
  });

  it("does not throw across an enabled -> disabled -> enabled transition", () => {
    const apply = vi.fn();
    const el = document.createElement("div");

    const { rerender, unmount } = renderHook(
      ({ enabled }) => {
        const elementRef = useRef<HTMLElement>(el);
        const pulseRef = useRef(0);
        useBeatPulseStyle(pulseRef, elementRef, apply, enabled);
      },
      { initialProps: { enabled: true } },
    );

    expect(() => rerender({ enabled: false })).not.toThrow();
    expect(() => rerender({ enabled: true })).not.toThrow();
    expect(() => unmount()).not.toThrow();
  });

  it("never calls apply when the element ref is null", () => {
    const apply = vi.fn();

    renderHook(() => {
      const elementRef = useRef<HTMLElement>(null);
      const pulseRef = useRef(0.5);
      useBeatPulseStyle(pulseRef, elementRef, apply, false);
    });

    expect(apply).not.toHaveBeenCalled();
  });
});
