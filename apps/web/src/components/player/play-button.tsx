"use client";

import { Play, Pause } from "lucide-react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";

export function PlayButton({
  tracks,
  label = "Play",
  variant = "brand",
}: {
  tracks: Song[];
  label?: string;
  /** "light" for use on top of colourful backgrounds. */
  variant?: "brand" | "light";
}) {
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const isCurrentTrackFirst = tracks[0]?.id === currentTrackId;
  const showPause = isCurrentTrackFirst && isPlaying;

  const handleClick = () => {
    if (tracks.length === 0) return;
    if (isCurrentTrackFirst) {
      togglePlay();
    } else {
      playQueue(tracks, 0);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={tracks.length === 0}
      className={`flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === "light" ? "bg-white text-background" : "bg-melune-gradient text-white"
      }`}
    >
      {showPause ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      {showPause ? "Pause" : label}
    </button>
  );
}
