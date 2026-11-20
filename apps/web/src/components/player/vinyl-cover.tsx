"use client";

import Image from "next/image";

interface VinylCoverProps {
  title: string;
  coverUrl?: string | null;
  isPlaying: boolean;
  size?: "sm" | "lg";
}

export function VinylCover({ title, coverUrl, isPlaying, size = "lg" }: VinylCoverProps) {
  const dimensions = size === "lg" ? "h-64 w-64 sm:h-80 sm:w-80" : "h-10 w-10";
  const textSize = size === "lg" ? "text-6xl" : "text-sm";

  return (
    <div
      className={`relative ${dimensions} shrink-0 rounded-full shadow-2xl ${
        isPlaying ? "animate-vinyl-spin" : ""
      }`}
      style={{ animationPlayState: isPlaying ? "running" : "paused" }}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes={size === "lg" ? "320px" : "40px"}
          className="rounded-full object-cover ring-4 ring-black/40"
        />
      ) : (
        <div
          className={`bg-codex-gradient flex h-full w-full items-center justify-center rounded-full font-bold text-white ring-4 ring-black/40 ${textSize}`}
        >
          {title.charAt(0).toUpperCase()}
        </div>
      )}
      {/* center label hole, purely decorative — sells the vinyl illusion */}
      {size === "lg" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 rounded-full bg-background ring-2 ring-black/60" />
        </div>
      )}
    </div>
  );
}
