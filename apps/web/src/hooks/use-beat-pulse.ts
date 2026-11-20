"use client";

import { useEffect, useRef, useState } from "react";
import { useAudioAnalyser } from "./use-audio-analyser";

export interface BeatPulse {
  /** 0..1, jumps to 1 the instant a beat is detected and exponentially
   *  decays every frame after — read this inside your own rAF loop
   *  (never as React state; see `useBeatPulseStyle`). */
  pulseRef: React.MutableRefObject<number>;
  /** Same meaning as `useAudioAnalyser`'s `reactive` — false once real
   *  frequency data isn't available (Web Audio unsupported, CORS-tainted
   *  source, suspended context). Beat detection is meaningless without
   *  real data, so treat this the same way `SonicCanvas` does: fall
   *  back to no pulse at all, not a fake/random one. */
  reactive: boolean;
  /** Rough estimated tempo in BPM, or `null` until enough consistent
   *  beats have been seen. Recomputed as new beats land, but only
   *  updated as React state a few times a minute at most — safe to
   *  render directly. */
  bpm: number | null;
}

// A window of recent bass samples used to compute a *local* rolling
// average, rather than a single global threshold — a quiet ballad and a
// loud drop both still produce beats relative to their own recent
// energy. ~0.7s at 60fps.
const HISTORY_FRAMES = 43;
// A sample must exceed its own recent local average by this factor,
// and clear an absolute floor (so near-silence doesn't "beat" on tiny
// relative bumps), to count as an onset.
const RELATIVE_THRESHOLD = 1.4;
const ABSOLUTE_FLOOR = 0.35;
// Refuses to fire two beats closer together than this — caps the
// fastest detectable tempo at 60000/220 ≈ 270 BPM, well above anything
// real music needs, and stops one loud hit from double-triggering.
const MIN_BEAT_INTERVAL_MS = 220;
// Per-frame decay multiplier for the pulse value — tuned so a pulse
// fades to near-zero over roughly 250-350ms, long enough to read as a
// pulse, short enough not to blur into the next beat at typical tempos.
const PULSE_DECAY = 0.88;
// BPM estimation is a coarse "average interval between recent onsets,"
// not real tempo-tracking (autocorrelation/onset-strength envelopes,
// which this project doesn't need for a visual flourish) — clamped to
// a plausible music range so a stray double/half-time read doesn't
// show something obviously wrong.
const BPM_MIN = 60;
const BPM_MAX = 200;
const BEAT_HISTORY_SIZE = 8;
const MIN_BEATS_FOR_ESTIMATE = 4;

/**
 * Phase: Tempo-Reactive UI. Layers simple energy-based beat-onset
 * detection on top of `useAudioAnalyser`'s existing bass level — no new
 * AnalyserNode, no new audio graph, just different math on data that
 * was already being read every frame for Sonic Canvas.
 *
 * Deliberately basic: this is a UI flourish (logo/play-button/card-
 * border pulse), not a DSP feature — a real beat tracker (onset-
 * strength envelopes, autocorrelation, tempo hypotheses with
 * confidence) would be a lot more code for a benefit nobody asked for
 * here. If a future phase needs accurate BPM (e.g. for a "sync visuals
 * to tempo" mode with stronger claims than "roughly pulses along"),
 * that's a real DSP task, not an extension of this hook.
 */
export function useBeatPulse(isPlaying: boolean): BeatPulse {
  const { levelsRef, reactive } = useAudioAnalyser(isPlaying);
  const pulseRef = useRef(0);
  const [bpm, setBpm] = useState<number | null>(null);

  useEffect(() => {
    if (!isPlaying || !reactive) {
      pulseRef.current = 0;
      setBpm(null);
      return;
    }

    const history: number[] = [];
    const beatTimes: number[] = [];
    let lastBeatAt = 0;
    let raf = 0;

    const tick = () => {
      const bass = levelsRef.current.bass;
      history.push(bass);
      if (history.length > HISTORY_FRAMES) history.shift();
      const localAverage = history.reduce((sum, v) => sum + v, 0) / history.length;

      const now = performance.now();
      const isOnset =
        bass > localAverage * RELATIVE_THRESHOLD &&
        bass > ABSOLUTE_FLOOR &&
        now - lastBeatAt > MIN_BEAT_INTERVAL_MS;

      if (isOnset) {
        pulseRef.current = 1;
        lastBeatAt = now;
        beatTimes.push(now);
        if (beatTimes.length > BEAT_HISTORY_SIZE) beatTimes.shift();

        if (beatTimes.length >= MIN_BEATS_FOR_ESTIMATE) {
          const intervals: number[] = [];
          for (let i = 1; i < beatTimes.length; i++) intervals.push(beatTimes[i] - beatTimes[i - 1]);
          const avgInterval = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
          const estimate = Math.round(60000 / avgInterval);
          if (estimate >= BPM_MIN && estimate <= BPM_MAX) setBpm(estimate);
        }
      } else {
        pulseRef.current *= PULSE_DECAY;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, reactive]);

  return { pulseRef, reactive, bpm };
}
