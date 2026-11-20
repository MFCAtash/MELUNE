"use client";

import { useEffect, useState } from "react";

/** Number of bars in a waveform bar. Enough detail to read as "the
 *  actual song", few enough to stay cheap to paint. */
export const PEAK_BUCKETS = 96;

// Decoding is the expensive part (a few hundred ms per track), and the
// only cost that matters here — so results are cached per URL for the
// life of the tab, which makes revisiting a track instant.
const peakCache = new Map<string, number[]>();

function cacheKey(url: string, buckets: number): string {
  return `${buckets}:${url}`;
}

/**
 * Decodes a track once and returns `buckets` normalized peak
 * amplitudes (0..1) for drawing a real waveform under the seek bar.
 *
 * Returns `null` while loading, when decoding isn't possible (no Web
 * Audio, CORS-blocked media, a codec the browser can't decode), or
 * when the request fails — every one of those cases degrades to the
 * plain seek bar, never to an error state.
 *
 * Deliberately decodes the *file* rather than reading the live
 * AnalyserNode: the analyser only knows what is playing right now,
 * while a waveform needs the whole track at once.
 */
export function useTrackPeaks(audioUrl: string | null, buckets: number = PEAK_BUCKETS): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(() =>
    audioUrl ? (peakCache.get(cacheKey(audioUrl, buckets)) ?? null) : null,
  );

  useEffect(() => {
    if (!audioUrl) {
      setPeaks(null);
      return;
    }

    const key = cacheKey(audioUrl, buckets);
    const cached = peakCache.get(key);
    if (cached) {
      setPeaks(cached);
      return;
    }

    let cancelled = false;
    setPeaks(null);

    computePeaks(audioUrl, buckets)
      .then((result) => {
        if (cancelled || !result) return;
        peakCache.set(key, result);
        setPeaks(result);
      })
      .catch(() => {
        // Waveform is decoration: any failure just means no waveform.
      });

    return () => {
      cancelled = true;
    };
  }, [audioUrl, buckets]);

  return peaks;
}

async function computePeaks(url: string, buckets: number): Promise<number[] | null> {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) return null;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) return null;

  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(bytes);
    return summarize(buffer, buckets);
  } finally {
    void ctx.close?.().catch(() => undefined);
  }
}

/** Reduces a decoded buffer to `buckets` peak values in 0..1. */
function summarize(buffer: AudioBuffer, buckets: number): number[] {
  const channel = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(channel.length / buckets));
  const peaks = new Array<number>(buckets).fill(0);

  for (let i = 0; i < buckets; i++) {
    const start = i * step;
    const end = Math.min(start + step, channel.length);
    let max = 0;
    // Sampling every ~8th frame is plenty for a 96-bar overview and
    // keeps a 5-minute track at a few milliseconds of work.
    for (let j = start; j < end; j += 8) {
      const v = Math.abs(channel[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }

  // Normalize to the loudest bucket so quiet masters still fill the
  // bar, then apply a gentle power curve: raw linear peaks look flat
  // and lifeless in a 20px-tall strip.
  const loudest = peaks.reduce((a, b) => (b > a ? b : a), 0);
  if (loudest <= 0) return peaks;
  return peaks.map((p) => Math.pow(p / loudest, 0.65));
}
