"use client";

import { useState } from "react";
import { Clock, GripVertical, Headphones, Play, Pause } from "lucide-react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { formatCount, formatDuration } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { LikeButton } from "@/components/library/like-button";
import { Cover } from "@/components/ui/cover";
import { AddToQueueButton } from "./add-to-queue-button";
import { SongMoreMenu } from "./song-more-menu";

export function TrackList({
  tracks,
  showArtist = false,
  actions,
  variant = "default",
  onReorder,
}: {
  tracks: Song[];
  showArtist?: boolean;
  /** Extra per-row controls (e.g. remove / move) rendered before the duration. */
  actions?: (track: Song, index: number) => React.ReactNode;
  /** `rich`: glass panel with artwork, play count, duration, like and a ⋯ menu. */
  variant?: "default" | "rich";
  /**
   * Enables real drag-to-reorder on the `default` variant: a grip handle
   * appears on each row and dragging one over another swaps them, calling
   * back with the full reordered track list on drop. The playlist page's
   * existing up/down buttons (passed via `actions`) stay as the
   * keyboard-/screen-reader-accessible way to do the same thing — drag is
   * additive, not a replacement.
   */
  onReorder?: (newOrder: Song[]) => void;
}) {
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const { t } = useTranslation();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = tracks.slice();
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorder?.(next);
    setDragIndex(null);
    setOverIndex(null);
  }

  if (tracks.length === 0) {
    return (
      <p className="rounded-2xl border border-border px-4 py-6 text-center text-sm text-muted">
        {t("queue.empty")}
      </p>
    );
  }

  if (variant === "rich") {
    return (
      <ul className="glass-panel divide-y divide-white/5">
        <li
          aria-hidden
          className="hidden items-center gap-4 px-4 py-2.5 text-xs uppercase tracking-wide text-muted md:flex"
        >
          <span className="w-4 shrink-0 text-center">#</span>
          <span className="min-w-0 flex-1" />
          <span className="flex w-24 items-center gap-1.5">
            <Headphones size={13} />
            {t("song.playsColumn")}
          </span>
          <span className="w-8 shrink-0" />
          <span className="flex w-16 items-center gap-1.5">
            <Clock size={13} />
            <span className="sr-only">{t("song.durationColumn")}</span>
          </span>
          <span className="w-8 shrink-0" />
        </li>
        {tracks.map((track, index) => {
          const isCurrent = track.id === currentTrackId;
          const active = isCurrent && isPlaying;
          return (
            <li
              key={track.id}
              className="group flex items-center gap-4 px-4 py-2.5 transition-colors first:rounded-t-[1.5rem] last:rounded-b-[1.5rem] hover:bg-white/5"
            >
              <button
                onClick={() => (isCurrent ? togglePlay() : playQueue(tracks, index))}
                aria-label={`${active ? t("player.pause") : t("player.play")} ${track.title}`}
                className="flex min-w-0 flex-1 items-center gap-4 text-start"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-sm text-muted">
                  <span className="group-hover:hidden">
                    {active ? <Pause size={14} className="text-primary" fill="currentColor" /> : index + 1}
                  </span>
                  <span className="hidden text-foreground group-hover:inline">
                    {active ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  </span>
                </span>
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg shadow-lg">
                  <Cover title={track.title} url={track.coverUrl} className="h-full w-full text-base" />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-sm font-medium ${isCurrent ? "text-primary" : "text-foreground"}`}>
                    {track.title}
                  </span>
                  <span className="block truncate text-xs text-muted">{track.artist.name}</span>
                </span>
              </button>
              <span className="hidden w-24 shrink-0 items-center gap-1.5 text-sm text-muted md:flex">
                <Headphones size={14} />
                {formatCount(track.playCount)}
              </span>
              <span className="flex w-8 shrink-0 items-center justify-center text-muted">
                <LikeButton songId={track.id} size={16} />
              </span>
              <span className="hidden w-16 shrink-0 items-center gap-1.5 text-sm text-muted md:flex">
                <Clock size={14} />
                {formatDuration(track.duration)}
              </span>
              <SongMoreMenu track={track} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {tracks.map((track, index) => {
        const isCurrent = track.id === currentTrackId;
        return (
          <li
            key={track.id}
            draggable={Boolean(onReorder)}
            onDragStart={onReorder ? () => setDragIndex(index) : undefined}
            onDragOver={
              onReorder
                ? (e) => {
                    e.preventDefault();
                    if (overIndex !== index) setOverIndex(index);
                  }
                : undefined
            }
            onDragEnd={
              onReorder
                ? () => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }
                : undefined
            }
            onDrop={
              onReorder
                ? (e) => {
                    e.preventDefault();
                    handleDrop(index);
                  }
                : undefined
            }
            className={`group flex w-full items-center justify-between px-4 py-3 hover:bg-surfaceElevated ${
              dragIndex === index ? "opacity-40" : ""
            } ${overIndex === index && dragIndex !== null && dragIndex !== index ? "border-t-2 border-primary" : ""}`}
          >
            {onReorder && (
              <span
                className="me-1 shrink-0 cursor-grab touch-none text-muted active:cursor-grabbing"
                aria-hidden
              >
                <GripVertical size={16} />
              </span>
            )}
            <button
              onClick={() => (isCurrent ? togglePlay() : playQueue(tracks, index))}
              className="flex min-w-0 flex-1 items-center gap-4 text-start"
            >
              <span className="flex w-4 shrink-0 items-center justify-center text-sm text-muted">
                <span className="group-hover:hidden">
                  {isCurrent && isPlaying ? (
                    <Pause size={14} className="text-primary" fill="currentColor" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="hidden group-hover:inline">
                  {isCurrent && isPlaying ? (
                    <Pause size={14} fill="currentColor" />
                  ) : (
                    <Play size={14} fill="currentColor" />
                  )}
                </span>
              </span>
              <span className="min-w-0">
                <span
                  className={`block truncate ${isCurrent ? "text-primary" : "text-foreground"}`}
                >
                  {track.title}
                </span>
                {showArtist && (
                  <span className="block truncate text-xs text-muted">
                    {track.artist.name}
                  </span>
                )}
              </span>
            </button>
            <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
              <LikeButton songId={track.id} size={16} />
              <span className="hidden opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">
                <AddToQueueButton track={track} size={16} />
              </span>
              <SongMoreMenu track={track} />
              {actions?.(track, index)}
              {formatDuration(track.duration)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
