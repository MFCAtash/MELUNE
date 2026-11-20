"use client";

import { useEffect } from "react";

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
interface WakeLockNavigator {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
}

/**
 * Keeps the screen awake while `active` (Screen Wake Lock API) so a
 * study timer isn't cut off by the display dimming. Silently does
 * nothing where the API is missing (older Safari/Firefox, jsdom) or the
 * request is refused (e.g. low battery). The browser drops the lock
 * whenever the tab is hidden, so it is re-requested on return.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const wakeLock = (navigator as unknown as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await wakeLock.request("screen");
        if (cancelled) {
          void next.release().catch(() => {});
          return;
        }
        // Two requests can be in flight at once (the tab becoming
        // visible again while the first is still pending). Whichever
        // resolves last wins the slot, so release the one it replaces
        // instead of orphaning it — an orphaned sentinel keeps the
        // screen awake until the page is closed.
        void sentinel?.release().catch(() => {});
        sentinel = next;
      } catch {
        // Refused or unsupported in this context — not worth surfacing.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void sentinel?.release().catch(() => {});
      sentinel = null;
      void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
