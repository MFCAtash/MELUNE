"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { formatDuration } from "@/lib/format";
import { LikeButton } from "@/components/library/like-button";
import { Cover } from "@/components/ui/cover";
import { GlassPanel, PanelHeader } from "@/components/ui/glass-panel";

/** Numbered top-songs list (01, 02, …) with a round play button per row. */
export function TrendingPanel({ songs, limit = 5 }: { songs: Song[]; limit?: number }) {
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const { t } = useTranslation();

  if (songs.length === 0) return null;
  const rows = songs.slice(0, limit);

  return (
    <GlassPanel aria-labelledby="home-trending" className="p-5">
      <PanelHeader id="home-trending" title={t("home.trending")} />
      <ol className="flex flex-col gap-1">
        {rows.map((song, index) => {
          const isCurrent = song.id === currentTrackId;
          const active = isCurrent && isPlaying;
          return (
            <li
              key={song.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5"
            >
              <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg shadow-lg">
                <Cover title={song.title} url={song.coverUrl} className="h-full w-full text-base" />
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={`/song/${song.slug}`}
                  className={`block truncate text-sm font-medium hover:underline ${
                    isCurrent ? "text-primary" : "text-foreground"
                  }`}
                >
                  {song.title}
                </Link>
                <Link
                  href={`/artist/${song.artist.slug}`}
                  className="block truncate text-xs text-muted hover:text-primary"
                >
                  {song.artist.name}
                </Link>
              </span>
              <span className="hidden text-xs tabular-nums text-muted sm:inline">
                {formatDuration(song.duration)}
              </span>
              <LikeButton songId={song.id} size={16} />
              <button
                onClick={() => (isCurrent ? togglePlay() : playQueue(songs, songs.indexOf(song)))}
                aria-label={`${active ? t("player.pause") : t("player.play")} ${song.title}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-glow-sm transition-transform hover:scale-105"
              >
                {active ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
              </button>
            </li>
          );
        })}
      </ol>
    </GlassPanel>
  );
}
