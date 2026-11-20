"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSharedAnalyser,
  isAnalyserPermanentlyUnavailable,
  resumeSharedAudioContext,
} from "@/lib/audio-analyser-bridge";

export interface AudioLevels {
  /** Low end (~bottom 15% of frequency bins), 0..1. */
  bass: number;
  /** Mid band, 0..1. */
  mid: number;
  /** High end, 0..1. */
  treble: number;
  /** Average of the three above, 0..1. */
  overall: number;
}

const SILENT_LEVEL_THRESHOLD = 0.01;
// ~90 frames at 60fps (~1.5s) of sustained silence while actively
// playing is treated as "this isn't giving us real data" (CORS-tainted
// source, or a context still suspended) rather than a quiet passage —
// long enough that an actual quiet intro rarely trips it, short enough
// that the fallback still feels immediate to the listener.
const SILENT_FRAMES_BEFORE_FALLBACK = 90;

const EMPTY_LEVELS: AudioLevels = { bass: 0, mid: 0, treble: 0, overall: 0 };

/**
 * Reads live frequency data from the single shared analyser (see
 * `audio-analyser-bridge.ts`) and exposes it via a ref updated every
 * animation frame — deliberately never as React state, so 60fps updates
 * don't cause 60fps re-renders. Consumers (`SonicCanvas`) read
 * `levelsRef.current` inside their own rAF loop.
 *
 * `reactive` (state, changes rarely) flips to `false` — and callers
 * should fall back to a non-audio-reactive visual — once real frequency
 * data hasn't been observed for a while during active playback. This
 * covers a CORS-tainted source, a still-suspended AudioContext, and "no
 * Web Audio support at all" with one fallback path instead of three
 * special cases, because the correct behavior is identical in all three.
 */
export function useAudioAnalyser(isPlaying: boolean) {
  const levelsRef = useRef<AudioLevels>(EMPTY_LEVELS);
  const [reactive, setReactive] = useState(true);
  const silentFrames = useRef(0);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!isPlaying) return;

    resumeSharedAudioContext();
    let raf = 0;

    const tick = () => {
      const analyser = getSharedAnalyser();

      if (!analyser) {
        if (isAnalyserPermanentlyUnavailable()) {
          // Nothing will ever change here — stop polling instead of
          // spinning a rAF loop forever for no benefit.
          setReactive(false);
          return;
        }
        // Transient: PlayerEngine's <audio> element hasn't registered
        // itself with the bridge yet (very first frames of the app).
        raf = requestAnimationFrame(tick);
        return;
      }

      if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
        dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }
      const data = dataRef.current;
      analyser.getByteFrequencyData(data);

      const n = data.length;
      const bassEnd = Math.max(1, Math.floor(n * 0.15));
      const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.5));
      const avg = (from: number, to: number) => {
        let sum = 0;
        for (let i = from; i < to; i++) sum += data[i];
        return to > from ? sum / (to - from) / 255 : 0;
      };
      const bass = avg(0, bassEnd);
      const mid = avg(bassEnd, midEnd);
      const treble = avg(midEnd, n);
      const overall = (bass + mid + treble) / 3;

      levelsRef.current = { bass, mid, treble, overall };

      if (overall < SILENT_LEVEL_THRESHOLD) {
        silentFrames.current += 1;
        if (silentFrames.current === SILENT_FRAMES_BEFORE_FALLBACK) {
          setReactive(false);
        }
      } else {
        silentFrames.current = 0;
        setReactive((prev) => (prev ? prev : true));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // A new isPlaying=true run (new track, resumed playback) deserves a
  // fresh chance before falling back again.
  useEffect(() => {
    if (isPlaying) {
      silentFrames.current = 0;
    }
  }, [isPlaying]);

  return { levelsRef, reactive };
}
