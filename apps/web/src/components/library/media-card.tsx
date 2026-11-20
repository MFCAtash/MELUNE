"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { Cover } from "@/components/ui/cover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePlayerStore } from "@/store/player-store";
import { useBeatPulse } from "@/hooks/use-beat-pulse";
import { useBeatPulseStyle } from "@/hooks/use-beat-pulse-style";

// Phase 10.2 — Player Polish: one shared spring for every grid tile's
// hover/press feedback (playlists, albums, artists), so the feel is
// consistent everywhere this component is used rather than tuned
// per-page. Reduced-motion gating uses the project's own `useMediaQuery`
// hook (see full-screen-player.tsx's comment) — not framer-motion's
// built-in `useReducedMotion`, which calls `window.matchMedia`
// unconditionally and is undefined in this project's jsdom test setup.
const cardSpring = { type: "spring", stiffness: 400, damping: 22 } as const;

/** Grid tile for playlists, albums and artists. */
export function MediaCard({
  href,
  title,
  subtitle,
  coverUrl,
  seed,
  round = false,
}: {
  href: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  seed?: string;
  round?: boolean;
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Tempo-Reactive UI: is *this* tile the album or artist currently
  // playing? Derived entirely from data the queue already carries
  // (`Song.album`/`Song.artist`, both slugged — see packages/types) by
  // reconstructing the same `/album/:slug` / `/artist/:slug` href every
  // call site already builds — no new player-store state, no prop
  // threading through every page that renders a MediaCard. A queue
  // played from a compilation/playlist context that isn't itself "an
  // album" simply won't match either href, which is the correct
  // behavior, not a gap: there's nothing today that would tell this
  // component which playlist a queue was started from (that would need
  // a `sourceId` on the player store — a real, separate task, flagged
  // in CHANGES rather than approximated with a string-title match that
  // could misfire on two differently-sourced items sharing a name).
  const currentTrack = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isNowPlaying =
    Boolean(currentTrack) &&
    (href === (currentTrack?.album ? `/album/${currentTrack.album.slug}` : null) ||
      href === (currentTrack?.artist ? `/artist/${currentTrack.artist.slug}` : null));

  const { pulseRef, reactive: beatReactive } = useBeatPulse(isPlaying && isNowPlaying);
  const cardRef = useRef<HTMLDivElement>(null);
  useBeatPulseStyle(
    pulseRef,
    cardRef,
    (el, pulse) => {
      el.style.boxShadow = pulse > 0.02 ? `0 0 0 2px ${pulse > 0.5 ? "rgb(139 92 246)" : "rgba(139, 92, 246, 0.6)"}` : "";
    },
    Boolean(isNowPlaying && isPlaying && beatReactive && !reduceMotion),
  );

  return (
    <Link href={href} className="group block rounded-xl p-2 focus-visible:bg-surface">
      <motion.div
        ref={cardRef}
        whileHover={reduceMotion ? undefined : { scale: 1.035, y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        transition={cardSpring}
        className="rounded-xl transition-colors group-hover:bg-surface group-focus-visible:bg-surface"
      >
        <div className={`aspect-square w-full overflow-hidden shadow-lg ${round ? "rounded-full" : "rounded-lg"}`}>
          <Cover
            title={title}
            url={coverUrl}
            seed={seed}
            className={`h-full w-full text-5xl ${round ? "rounded-full" : "rounded-lg"}`}
          />
        </div>
        <p className={`mt-3 truncate text-sm font-medium text-foreground ${round ? "text-center" : ""}`}>
          {title}
        </p>
        {subtitle && (
          <p className={`truncate text-xs text-muted ${round ? "text-center" : ""}`}>{subtitle}</p>
        )}
      </motion.div>
    </Link>
  );
}

export const mediaGridClass =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
