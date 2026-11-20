"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Elapsed-seconds counter for Focus Mode that only advances while
 * `running` is true (wired to "music is playing", so pausing the music
 * pauses the study clock too).
 *
 * Time is accumulated from `Date.now()` deltas, not by counting interval
 * ticks: browsers throttle timers in background tabs (exactly where a
 * study timer lives), and tick-counting would silently lose minutes.
 * The 500ms interval only refreshes what is shown.
 */
export function useFocusTimer(running: boolean): { elapsedSeconds: number; reset: () => void } {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const accumulatedMs = useRef(0);
  const startedAt = useRef<number | null>(null);

  const publish = useCallback(() => {
    const live = startedAt.current === null ? 0 : Date.now() - startedAt.current;
    setElapsedSeconds(Math.floor((accumulatedMs.current + live) / 1000));
  }, []);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const id = setInterval(publish, 500);
    return () => {
      clearInterval(id);
      if (startedAt.current !== null) {
        accumulatedMs.current += Date.now() - startedAt.current;
        startedAt.current = null;
      }
      publish();
    };
  }, [running, publish]);

  const reset = useCallback(() => {
    accumulatedMs.current = 0;
    if (startedAt.current !== null) startedAt.current = Date.now();
    setElapsedSeconds(0);
  }, []);

  return { elapsedSeconds, reset };
}
