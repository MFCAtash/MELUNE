import { describe, it, expect } from "vitest";
import type { Song } from "@codex-music/types";
import {
  buildQueueStrip,
  segmentWeight,
  stripProgress,
  QUEUE_STRIP_MAX_PLAYED,
  QUEUE_STRIP_MAX_UPCOMING,
} from "../queue-strip";

function song(n: number, duration = 200): Song {
  return {
    id: `s${n}`,
    title: `Song ${n}`,
    slug: `song-${n}`,
    duration,
    audioUrl: `https://example.com/${n}.mp3`,
    coverUrl: null,
    playCount: 0,
    artist: { id: "a", name: "Artist", slug: "artist", imageUrl: null },
    album: null,
    genre: null,
  };
}
const queueOf = (n: number) => Array.from({ length: n }, (_, i) => song(i));

describe("segmentWeight", () => {
  it("clamps very long and very short tracks", () => {
    expect(segmentWeight(2400)).toBe(600);
    expect(segmentWeight(5)).toBe(60);
    expect(segmentWeight(240)).toBe(240);
  });

  it("falls back to a default for missing/invalid durations instead of zero width", () => {
    expect(segmentWeight(0)).toBe(180);
    expect(segmentWeight(-3)).toBe(180);
    expect(segmentWeight(Number.NaN)).toBe(180);
  });
});

describe("stripProgress", () => {
  it("returns a 0..1 fraction and clamps bad input", () => {
    expect(stripProgress(50, 200)).toBe(0.25);
    expect(stripProgress(500, 200)).toBe(1);
    expect(stripProgress(-5, 200)).toBe(0);
    expect(stripProgress(10, 0)).toBe(0);
    expect(stripProgress(Number.NaN, 200)).toBe(0);
  });
});

describe("buildQueueStrip", () => {
  it("is empty for an empty queue or an invalid current index", () => {
    expect(buildQueueStrip([], 0).segments).toEqual([]);
    expect(buildQueueStrip(queueOf(3), -1).segments).toEqual([]);
    expect(buildQueueStrip(queueOf(3), 3).segments).toEqual([]);
  });

  it("marks played / current / upcoming around the current track", () => {
    const model = buildQueueStrip(queueOf(5), 2);
    expect(model.segments.map((s) => [s.index, s.state])).toEqual([
      [0, "played"],
      [1, "played"],
      [2, "current"],
      [3, "upcoming"],
      [4, "upcoming"],
    ]);
    expect(model.upcomingCount).toBe(2);
    expect(model.hiddenUpcoming).toBe(0);
  });

  it("keeps only the last few played tracks", () => {
    const model = buildQueueStrip(queueOf(10), 6);
    const played = model.segments.filter((s) => s.state === "played");
    expect(played).toHaveLength(QUEUE_STRIP_MAX_PLAYED);
    expect(played[0].index).toBe(6 - QUEUE_STRIP_MAX_PLAYED);
  });

  it("windows upcoming tracks and reports how many are hidden", () => {
    const model = buildQueueStrip(queueOf(30), 0);
    expect(model.upcomingCount).toBe(QUEUE_STRIP_MAX_UPCOMING);
    expect(model.hiddenUpcoming).toBe(30 - 1 - QUEUE_STRIP_MAX_UPCOMING);
    expect(model.segments).toHaveLength(1 + QUEUE_STRIP_MAX_UPCOMING);
  });

  it("has no upcoming tracks when the current one is last", () => {
    const model = buildQueueStrip(queueOf(3), 2);
    expect(model.upcomingCount).toBe(0);
    expect(model.hiddenUpcoming).toBe(0);
  });

  it("weights segments by track duration", () => {
    const model = buildQueueStrip([song(0, 100), song(1, 300)], 0);
    expect(model.segments.map((s) => s.weight)).toEqual([100, 300]);
  });
});
