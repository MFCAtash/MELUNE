"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Disc3, Download, ListEnd, ListPlus, Loader2, MoreHorizontal, Radio, Trash2, UserRound } from "lucide-react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { useOfflineTrack } from "@/hooks/use-offline-track";
import { apiClient } from "@/lib/api-client";

/** The "⋯" row menu: queue actions and shortcuts to the artist/album. */
export function SongMoreMenu({ track }: { track: Song }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const hasQueue = usePlayerStore((s) => s.queue.length > 0);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const { t } = useTranslation();
  const offline = useOfflineTrack(track);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-foreground transition-colors hover:bg-white/10";

  /** "Infinite radio": builds a queue seeded with this track, then ranks
   *  the rest of the catalog by similarity — same genre first, then same
   *  artist, then everything else shuffled — and starts playing. Purely
   *  client-side over one catalog page (100 songs), which is plenty for
   *  a seeded radio session and needs no new API. */
  const playSimilar = async () => {
    setLoadingSimilar(true);
    try {
      const page = await apiClient.listSongs({ limit: 100 });
      const pool = page.items.filter((s) => s.id !== track.id);
      const sameGenre = pool.filter((s) => s.genre?.id && s.genre.id === track.genre?.id);
      const sameArtist = pool.filter(
        (s) => s.artist.id === track.artist.id && !sameGenre.includes(s),
      );
      const rest = pool.filter((s) => !sameGenre.includes(s) && !sameArtist.includes(s));
      const pickShuffled = (arr: Song[]) => [...arr].sort(() => Math.random() - 0.5);
      const similar = [...pickShuffled(sameGenre), ...pickShuffled(sameArtist), ...pickShuffled(rest)].slice(0, 24);
      playQueue([track, ...similar], 0);
    } finally {
      setLoadingSimilar(false);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("song.moreActions")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-foreground"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-30 mt-1 w-52 rounded-xl border border-white/10 bg-surfaceElevated p-1.5 shadow-glass"
        >
          <button
            role="menuitem"
            className={item}
            disabled={loadingSimilar}
            onClick={() => void playSimilar()}
          >
            {loadingSimilar ? (
              <Loader2 size={16} className="animate-spin text-muted" />
            ) : (
              <Radio size={16} className="text-muted" />
            )}
            {t("song.playSimilar")}
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              addToQueue(track, hasQueue ? "next" : "end");
              setOpen(false);
            }}
          >
            <ListPlus size={16} className="text-muted" />
            {t("queue.playNext")}
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              addToQueue(track, "end");
              setOpen(false);
            }}
          >
            <ListEnd size={16} className="text-muted" />
            {t("queue.addToQueue")}
          </button>
          <Link role="menuitem" href={`/artist/${track.artist.slug}`} className={item} onClick={() => setOpen(false)}>
            <UserRound size={16} className="text-muted" />
            {t("song.goToArtist")}
          </Link>
          {track.album && (
            <Link role="menuitem" href={`/album/${track.album.slug}`} className={item} onClick={() => setOpen(false)}>
              <Disc3 size={16} className="text-muted" />
              {t("song.goToAlbum")}
            </Link>
          )}
          {offline.supported && (
            <button
              role="menuitem"
              className={item}
              disabled={offline.downloading}
              onClick={() => {
                if (offline.downloaded) {
                  void offline.remove();
                } else {
                  void offline.download();
                }
                setOpen(false);
              }}
            >
              {offline.downloading ? (
                <Loader2 size={16} className="animate-spin text-muted" />
              ) : offline.downloaded ? (
                <Trash2 size={16} className="text-muted" />
              ) : (
                <Download size={16} className="text-muted" />
              )}
              {offline.downloading
                ? t("song.downloading")
                : offline.downloaded
                  ? t("song.removeDownload")
                  : t("song.downloadOffline")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
