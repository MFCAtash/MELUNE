import type { Song } from "@melune/types";

/**
 * Pure model behind the queue color strip: which queue entries appear as
 * segments, in what state, and how wide. Kept free of React/DOM so the
 * windowing rules are unit-testable on their own.
 */

/** Upcoming tracks previewed as colored segments. Beyond this the strip
 *  ends in a faint "more" cap instead of growing without bound. */
export const QUEUE_STRIP_MAX_UPCOMING = 8;
/** Already-played tracks kept (dimmed) to the left of the current one, so
 *  the strip reads as a position in the queue rather than a bare list. */
export const QUEUE_STRIP_MAX_PLAYED = 2;

const FALLBACK_DURATION_SECONDS = 180;
const MIN_WEIGHT_SECONDS = 60;
const MAX_WEIGHT_SECONDS = 600;

export type QueueStripState = "played" | "current" | "upcoming";

export interface QueueStripSegment {
  song: Song;
  /** Index into the live queue. */
  index: number;
  state: QueueStripState;
  /** Relative width (seconds, clamped) — a long track gets a wider segment. */
  weight: number;
}

export interface QueueStripModel {
  segments: QueueStripSegment[];
  /** Upcoming tracks past the window — drives the trailing "more" cap. */
  hiddenUpcoming: number;
  /** Upcoming tracks that are shown. */
  upcomingCount: number;
}

/** Track duration → segment width. Clamped so one 40-minute mix can't
 *  flatten the rest into slivers, and a missing/zero duration still gets
 *  a sensible default instead of a zero-width (invisible) segment. */
export function segmentWeight(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return FALLBACK_DURATION_SECONDS;
  return Math.min(MAX_WEIGHT_SECONDS, Math.max(MIN_WEIGHT_SECONDS, durationSeconds));
}

/** 0..1 fill for the current segment; NaN/negative/overflow all clamp. */
export function stripProgress(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
}

export function buildQueueStrip(
  queue: readonly Song[],
  currentIndex: number,
  options: { maxUpcoming?: number; maxPlayed?: number } = {},
): QueueStripModel {
  const maxUpcoming = options.maxUpcoming ?? QUEUE_STRIP_MAX_UPCOMING;
  const maxPlayed = options.maxPlayed ?? QUEUE_STRIP_MAX_PLAYED;

  if (queue.length === 0 || currentIndex < 0 || currentIndex >= queue.length) {
    return { segments: [], hiddenUpcoming: 0, upcomingCount: 0 };
  }

  const start = Math.max(0, currentIndex - maxPlayed);
  const end = Math.min(queue.length, currentIndex + 1 + maxUpcoming);

  const segments: QueueStripSegment[] = [];
  for (let index = start; index < end; index++) {
    const song = queue[index];
    segments.push({
      song,
      index,
      state: index < currentIndex ? "played" : index === currentIndex ? "current" : "upcoming",
      weight: segmentWeight(song.duration),
    });
  }

  return {
    segments,
    hiddenUpcoming: queue.length - end,
    upcomingCount: end - (currentIndex + 1),
  };
}
