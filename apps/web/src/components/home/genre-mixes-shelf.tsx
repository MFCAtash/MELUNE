"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { coverGradient } from "@/lib/cover";
import type { GenreMix } from "@/lib/home";

/** One genre tile: gradient background (same `coverGradient` used on the
 *  genre detail page, keyed by genre id so it's stable), name, song count
 *  and a play button that queues this genre's songs — the same songs
 *  already fetched for Home, not a fresh genre-wide fetch. */
function GenreMixCard({ mix }: { mix: GenreMix }) {
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const { t } = useTranslation();

  const isCurrentMix = mix.songs.some((song) => song.id === currentTrackId);
  const active = isCurrentMix && isPlaying;
  const onPlay = () => (isCurrentMix ? togglePlay() : playQueue(mix.songs, 0));

  return (
    <li
      className="relative h-36 w-56 shrink-0 overflow-hidden rounded-2xl shadow-glow ring-1 ring-white/10"
      style={{ background: coverGradient(mix.genre.id) }}
    >
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
      <Link href={`/genre/${mix.genre.slug}`} className="absolute inset-0 p-4">
        <span className="block truncate text-lg font-bold text-white">{mix.genre.name}</span>
        <span className="mt-1 block text-xs text-white/80">
          {t("home.songsCount", { count: mix.songs.length })}
        </span>
      </Link>
      <button
        onClick={onPlay}
        aria-label={`${active ? t("player.pause") : t("player.play")}: ${mix.genre.name}`}
        className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-background shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {active ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
    </li>
  );
}

/** Horizontal shelf of genre mixes, same layout rhythm as `SongShelf`.
 *  Renders nothing until at least one genre has enough distinct songs —
 *  see `pickGenreMixes`. Shared between the desktop Home layout and
 *  `MobileHome`, so the bleed-to-edge margins cover both containers. */
export function GenreMixesShelf({ mixes }: { mixes: GenreMix[] }) {
  const { t } = useTranslation();
  if (mixes.length === 0) return null;

  return (
    <section aria-labelledby="home-genre-mixes">
      <h2 id="home-genre-mixes" className="mb-4 text-xl font-semibold text-foreground">
        {t("home.genreMixes")}
      </h2>
      <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {mixes.map((mix) => (
          <GenreMixCard key={mix.genre.id} mix={mix} />
        ))}
      </ul>
    </section>
  );
}
