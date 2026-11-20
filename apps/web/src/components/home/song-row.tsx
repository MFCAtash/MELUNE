"use client";

import { Clock, Headphones, Pause, Play } from "lucide-react";
import { motion } from "framer-motion";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTranslation } from "@/hooks/use-translation";
import { formatCount, formatDuration } from "@/lib/format";
import { LikeButton } from "@/components/library/like-button";
import { Cover } from "@/components/ui/cover";

/**
 * Compact phone row: artwork, title/artist, heart and a round play button.
 * On sm+ viewports it also shows play count and duration (hidden on phones
 * to keep the row from getting crowded), matching the `rich` TrackList row.
 */
export function SongRow({ song, queue }: { song: Song; queue: Song[] }) {
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const { t, locale } = useTranslation();
  // See full-screen-player.tsx's comment: the project's own hook, not
  // framer-motion's `useReducedMotion` (which calls `window.matchMedia`
  // unconditionally — undefined in this project's jsdom test setup).
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const isCurrent = song.id === currentTrackId;
  const active = isCurrent && isPlaying;
  const toggle = () => (isCurrent ? togglePlay() : playQueue(queue, Math.max(queue.indexOf(song), 0)));
  const label = `${active ? t("player.pause") : t("player.play")} ${song.title}`;

  return (
    <motion.li
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/5"
    >
      <button onClick={toggle} aria-label={label} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-lg">
          <Cover title={song.title} url={song.coverUrl} className="h-full w-full text-lg" />
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm font-medium ${isCurrent ? "text-primary" : "text-foreground"}`}>
            {song.title}
          </span>
          <span className="block truncate text-xs text-muted">{song.artist.name}</span>
        </span>
      </button>
      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:flex">
        <Headphones size={13} />
        {formatCount(song.playCount, locale)}
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:flex">
        <Clock size={13} />
        {formatDuration(song.duration)}
      </span>
      <LikeButton songId={song.id} size={18} />
      <button
        onClick={toggle}
        aria-label={label}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-primary hover:text-white"
      >
        {active ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
    </motion.li>
  );
}
