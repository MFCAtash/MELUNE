import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWakeLock } from "../use-wake-lock";

function fakeSentinel() {
  return { release: vi.fn().mockResolvedValue(undefined) };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useWakeLock", () => {
  afterEach(() => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    setVisibility("visible");
  });

  it("does nothing, without throwing, where the Wake Lock API doesn't exist", () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("does not request a lock while inactive", () => {
    const request = vi.fn();
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it("requests a screen lock while active and releases it on unmount", async () => {
    const sentinel = fakeSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });

    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).toHaveBeenCalledWith("screen");

    unmount();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it("swallows a refused request", async () => {
    const request = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    await act(async () => {});
  });

  it("releases a lock that resolves after unmount instead of leaking it", async () => {
    let resolve!: (s: ReturnType<typeof fakeSentinel>) => void;
    const late = new Promise<ReturnType<typeof fakeSentinel>>((r) => (resolve = r));
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: vi.fn().mockReturnValue(late) } });

    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    const sentinel = fakeSentinel();
    await act(async () => {
      resolve(sentinel);
      await late;
    });
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it("never orphans a sentinel when two requests overlap after a visibility change", async () => {
    const first = fakeSentinel();
    const second = fakeSentinel();
    let resolveFirst!: (s: typeof first) => void;
    const firstPending = new Promise<typeof first>((r) => (resolveFirst = r));
    const request = vi.fn().mockReturnValueOnce(firstPending).mockResolvedValueOnce(second);
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });

    const { unmount } = renderHook(() => useWakeLock(true));
    // Tab returns to the foreground while the first request is still pending.
    act(() => setVisibility("visible"));
    await act(async () => {}); // second resolves first
    await act(async () => {
      resolveFirst(first);
      await firstPending;
    });

    // Whichever landed last replaced the other — the loser must be released.
    expect(first.release.mock.calls.length + second.release.mock.calls.length).toBe(1);

    unmount();
    // After teardown every sentinel that ever resolved has been released.
    expect(first.release).toHaveBeenCalled();
    expect(second.release).toHaveBeenCalled();
  });
});
