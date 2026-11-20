"use client";

import { useEffect, useState } from "react";
import { getCachedTrackColor, hashToHsl, loadTrackColor } from "@/lib/track-color";

/**
 * Returns an ambient color for the given track: real extraction from
 * `coverUrl` when present and readable, otherwise a deterministic
 * fallback derived from `seed` (title + artist) so every track still
 * gets a distinct, stable glow.
 *
 * The extraction/fallback logic itself lives in `lib/track-color.ts`
 * (shared with the queue color strip); this hook is now just the
 * React-state wrapper around it. Behavior for callers is unchanged,
 * except that a cover the queue strip already decoded resolves without
 * a second image load.
 */
export function useAmbientColor(coverUrl: string | null | undefined, seed: string): string {
  const fallback = hashToHsl(seed);
  const [color, setColor] = useState(() => getCachedTrackColor(coverUrl, seed) ?? fallback);

  useEffect(() => {
    let cancelled = false;

    if (!coverUrl) {
      setColor(fallback);
      return;
    }

    loadTrackColor(coverUrl, seed).then((resolved) => {
      if (!cancelled) setColor(resolved);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverUrl, seed]);

  return color;
}
