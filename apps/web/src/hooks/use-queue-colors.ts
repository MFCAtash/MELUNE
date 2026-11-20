"use client";

import { useEffect, useMemo, useState } from "react";
import type { Song } from "@melune/types";
import { useAmbientThemeStore } from "@/store/ambient-theme-store";
import { useMediaQuery } from "./use-media-query";
import { resolveAmbientColor } from "@/lib/ambient-color-utils";
import { getCachedTrackColor, hashToHsl, loadTrackColor, trackColorKey, trackColorSeed } from "@/lib/track-color";

/**
 * Ambient colors for a list of tracks (the queue color strip), in the
 * same order as `tracks`.
 *
 * It is `useAmbientTheme` for many songs at once: same extraction
 * (`lib/track-color`), same mode gate and contrast clamp
 * (`resolveAmbientColor`), so a segment always shows the color that song
 * will have once it is the current track. Colors are resolved lazily —
 * the first render uses the cache or the deterministic fallback hue, and
 * segments settle to the real artwork color as each extraction finishes.
 *
 * `tracks` may be a fresh array every render; effects key off a joined
 * string of per-track keys, not array identity.
 */
export function useQueueColors(tracks: readonly Song[]): string[] {
  const mode = useAmbientThemeStore((s) => s.mode);
  const prefersHighContrast = useMediaQuery("(prefers-contrast: more)");
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const entries = tracks.map((song) => {
    const seed = trackColorSeed(song);
    return { seed, coverUrl: song.coverUrl, key: trackColorKey(song.coverUrl, seed) };
  });
  const signature = entries.map((e) => e.key).join("\n");

  useEffect(() => {
    let cancelled = false;
    for (const { key, coverUrl, seed } of entries) {
      loadTrackColor(coverUrl, seed).then((color) => {
        if (cancelled) return;
        setResolved((prev) => (prev[key] === color ? prev : { ...prev, [key]: color }));
      });
    }
    return () => {
      cancelled = true;
    };
    // `entries` is derived from `signature`; depending on the string keeps
    // the effect from re-running on every render of a fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return useMemo(
    () =>
      entries.map(({ key, coverUrl, seed }) =>
        resolveAmbientColor(
          resolved[key] ?? getCachedTrackColor(coverUrl, seed) ?? hashToHsl(seed),
          mode,
          prefersHighContrast,
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, resolved, mode, prefersHighContrast],
  );
}
