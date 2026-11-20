import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFocusTimer } from "../use-focus-timer";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

describe("useFocusTimer", () => {
  it("counts seconds only while running", () => {
    const { result, rerender } = renderHook(({ running }) => useFocusTimer(running), {
      initialProps: { running: true },
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.elapsedSeconds).toBe(3);

    rerender({ running: false });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.elapsedSeconds).toBe(3);

    rerender({ running: true });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.elapsedSeconds).toBe(5);
  });

  it("does not advance at all when it never runs", () => {
    const { result } = renderHook(() => useFocusTimer(false));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it("reset returns to zero and keeps counting from now while running", () => {
    const { result } = renderHook(() => useFocusTimer(true));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.elapsedSeconds).toBe(4);

    act(() => result.current.reset());
    expect(result.current.elapsedSeconds).toBe(0);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.elapsedSeconds).toBe(2);
  });
});
