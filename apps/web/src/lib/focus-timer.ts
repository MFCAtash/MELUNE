/**
 * Pure helpers for Focus Mode's study timer. The React side (ticking,
 * pausing with playback) lives in `hooks/use-focus-timer.ts`.
 */

/** Session lengths the timer cycles through. `null` = open-ended
 *  stopwatch (counts up); a number = countdown from that many minutes. */
export const FOCUS_TARGETS = [null, 25, 45, 60] as const;
export type FocusTarget = (typeof FOCUS_TARGETS)[number];

export function nextFocusTarget(current: FocusTarget): FocusTarget {
  const i = FOCUS_TARGETS.indexOf(current);
  return FOCUS_TARGETS[(i + 1) % FOCUS_TARGETS.length];
}

/** "05:03" under an hour, "1:05:03" from an hour up. Latin digits, like
 *  `formatDuration` elsewhere in the player. Negative/NaN clamp to 0. */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${String(minutes).padStart(2, "0")}:${ss}`;
}

export interface FocusClock {
  /** Seconds to show on the big clock. */
  displaySeconds: number;
  /** True once a countdown has reached zero (never true for the stopwatch). */
  complete: boolean;
}

export function focusClock(elapsedSeconds: number, target: FocusTarget): FocusClock {
  if (target === null) return { displaySeconds: elapsedSeconds, complete: false };
  const total = target * 60;
  return {
    displaySeconds: Math.max(0, total - elapsedSeconds),
    complete: elapsedSeconds >= total,
  };
}
