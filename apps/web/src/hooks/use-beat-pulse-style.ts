"use client";

import { useEffect, useRef } from "react";

/**
 * Applies a `BeatPulse.pulseRef` (0..1, decaying every frame — see
 * `use-beat-pulse.ts`) to a DOM element every animation frame, entirely
 * outside React — the same "ref in, direct DOM mutation, zero
 * re-renders" approach `sonic-canvas.tsx` already uses for its own rAF
 * loop, just generalized so the logo, the play button, and MediaCard's
 * border don't each need to hand-roll their own loop.
 *
 * `apply` is read from a ref on every frame (not a `useEffect`
 * dependency), so passing a fresh inline arrow function each render
 * never restarts the loop and never goes stale — only `enabled`
 * starting/stopping actually matters here.
 */
export function useBeatPulseStyle(
  pulseRef: React.MutableRefObject<number>,
  elementRef: React.RefObject<HTMLElement>,
  apply: (element: HTMLElement, pulse: number) => void,
  enabled: boolean,
) {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!enabled) {
      // Reset to the neutral (pulse=0) state once when turning off —
      // otherwise whatever the last applied frame looked like (e.g. a
      // brightened/scaled-up logo) would stay stuck after pausing.
      const el = elementRef.current;
      if (el) applyRef.current(el, 0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const el = elementRef.current;
      if (el) applyRef.current(el, pulseRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
