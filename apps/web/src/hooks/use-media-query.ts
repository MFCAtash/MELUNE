"use client";

import { useEffect, useState } from "react";

/**
 * Reads a CSS media query (e.g. `"(prefers-contrast: more)"`) and stays
 * in sync with it. Guards `window.matchMedia` being unavailable (SSR,
 * or an environment that doesn't implement it, like this project's
 * jsdom test setup) by defaulting to `false` rather than throwing —
 * matches the same guard already used inline for
 * `prefers-reduced-motion` in `sonic-canvas.tsx`.
 *
 * Design-system note: this is the first *reusable* version of that
 * pattern. `sonic-canvas.tsx`'s inline `prefers-reduced-motion` check
 * predates this hook (Phase 10) and hasn't been touched here to keep
 * this phase's diff scoped to the Ambient Theme Engine — a natural
 * candidate to fold into this hook in a later pass.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);

  return matches;
}
