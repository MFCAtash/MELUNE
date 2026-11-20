import { describe, it, expect } from "vitest";
import { focusClock, formatClock, nextFocusTarget } from "../focus-timer";

describe("formatClock", () => {
  it("formats minutes:seconds under an hour", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(25 * 60)).toBe("25:00");
  });

  it("adds hours from one hour up", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("floors fractions and clamps negative / NaN to zero", () => {
    expect(formatClock(59.9)).toBe("00:59");
    expect(formatClock(-4)).toBe("00:00");
    expect(formatClock(Number.NaN)).toBe("00:00");
  });
});

describe("focusClock", () => {
  it("stopwatch counts up and never completes", () => {
    expect(focusClock(90, null)).toEqual({ displaySeconds: 90, complete: false });
  });

  it("countdown shows remaining time and completes at zero", () => {
    expect(focusClock(60, 25)).toEqual({ displaySeconds: 25 * 60 - 60, complete: false });
    expect(focusClock(25 * 60, 25)).toEqual({ displaySeconds: 0, complete: true });
    expect(focusClock(25 * 60 + 40, 25)).toEqual({ displaySeconds: 0, complete: true });
  });
});

describe("nextFocusTarget", () => {
  it("cycles stopwatch -> 25 -> 45 -> 60 -> stopwatch", () => {
    expect(nextFocusTarget(null)).toBe(25);
    expect(nextFocusTarget(25)).toBe(45);
    expect(nextFocusTarget(45)).toBe(60);
    expect(nextFocusTarget(60)).toBeNull();
  });
});
