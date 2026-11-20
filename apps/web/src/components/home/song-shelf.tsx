"use client";

import Link from "next/link";
import { Play, Pause } from "lucide-react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { LikeButton } from "@/components/library/like-button";
import { Cover } from "@/components/ui/cover";

export function SongCard({ song, queue }: { song: Song; queue: Song[] }) {
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const isCurrent = song.id === currentTrackId;
  const active = isCurrent && isPlaying;

  return (
    <li className="w-40 shrink-0 sm:w-44">
      <button
        onClick={() =>
          isCurrent ? togglePlay() : playQueue(queue, queue.findIndex((s) => s.id === song.id))
        }
        aria-label={`${active ? "Pause" : "Play"} ${song.title}`}
        className="group relative block h-40 w-40 overflow-hidden rounded-xl sm:h-44 sm:w-44"
      >
        <Cover title={song.title} url={song.coverUrl} className="h-full w-full text-4xl" />
        <span
          className={`absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-glow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
            active ? "opacity-100" : "opacity-0"
          }`}
        >
          {active ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
        </span>
      </button>
      <div className="mt-2 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <Link
            href={`/song/${song.slug}`}
            className={`block truncate text-sm hover:underline ${isCurrent ? "text-primary" : "text-foreground"}`}
          >
            {song.title}
          </Link>
          <Link
            href={`/artist/${song.artist.slug}`}
            className="block truncate text-xs text-muted hover:text-primary"
          >
            {song.artist.name}
          </Link>
        </div>
        <LikeButton songId={song.id} size={16} />
      </div>
    </li>
  );
}

export function SongShelf({ title, songs }: { title: string; songs: Song[] }) {
  if (songs.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {songs.map((song) => (
          <SongCard key={song.id} song={song} queue={songs} />
        ))}
      </ul>
    </section>
  );
}
