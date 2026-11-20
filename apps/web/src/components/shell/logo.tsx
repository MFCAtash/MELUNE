"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePlayerStore } from "@/store/player-store";
import { useBeatPulse } from "@/hooks/use-beat-pulse";
import { useBeatPulseStyle } from "@/hooks/use-beat-pulse-style";
// The project's own reduced-motion hook, not framer-motion's built-in
// `useReducedMotion` — see media-card.tsx's comment: framer-motion's
// version calls `window.matchMedia` unconditionally, which is
// undefined in this project's jsdom test setup.
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The "MELUNE" wordmark — was duplicated verbatim in
 * `sidebar.tsx` (desktop) and `topbar.tsx` (mobile, `md:hidden`); this
 * is a small consolidation on top of the Tempo-Reactive UI work, not a
 * visual change to either of those, so both now render this instead of
 * their own copy of the same className string.
 *
 * Brand treatment: the poetic serif (`font-brand`, Cormorant Garamond)
 * over the pearlescent `.brand-wordmark` gradient with a soft double
 * glow, plus a breathing light halo rendered behind the letters — the
 * "moon" in MELUNE.
 *
 * Tempo-Reactive UI: while a track is playing, the wordmark takes on a
 * very subtle brightness/scale pulse synced to detected beats (see
 * `use-beat-pulse.ts`) — applied via direct DOM mutation
 * (`useBeatPulseStyle`), not React state, so it costs nothing extra on
 * every render. Skipped entirely under `prefers-reduced-motion`, and
 * naturally does nothing when nothing is playing or no usable
 * frequency data is available (`reactive: false`) — same fallback
 * philosophy as `SonicCanvas`.
 */
export function Logo({ className = "", text = "MELUNE" }: { className?: string; text?: string }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { pulseRef, reactive } = useBeatPulse(isPlaying);
  const ref = useRef<HTMLAnchorElement>(null);

  useBeatPulseStyle(
    pulseRef,
    ref,
    (el, pulse) => {
      el.style.filter = `brightness(${1 + pulse * 0.35})`;
      el.style.transform = `scale(${1 + pulse * 0.035})`;
    },
    Boolean(isPlaying && reactive && !prefersReducedMotion),
  );

  return (
    <Link
      ref={ref}
      href="/"
      className={`relative inline-flex w-fit items-center ${className}`}
    >
      {/* Decorative moonlit halo behind the letters — pure CSS, never
          intercepts clicks or assistive tech. */}
      <span
        aria-hidden
        className="brand-halo brand-halo-breathe pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[2.4em] w-[2.4em] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
      <span className="brand-wordmark font-brand font-semibold">{text}</span>
    </Link>
  );
}
