// Lyrics provider contract. `apiLyricsProvider` is the real one (backed by
// the `lyrics` table and the LRC upload endpoint); `mockLyricsProvider` is
// kept only for component tests that need deterministic lines.
// FullScreenPlayer depends solely on this shape, so swapping providers
// never changes a component that renders lyrics.

export interface LyricLine {
  timeSeconds: number;
  text: string;
}

export interface LyricsProvider {
  getLyrics(songId: string): Promise<LyricLine[] | null>;
}

import { apiClient } from "@/lib/api-client";

/** Real provider: reads the uploaded `.lrc` document for this song from
 *  the API. `null` (404 / network failure) is a normal "no lyrics yet"
 *  state — the player just shows an empty tab instead of inventing text. */
export const apiLyricsProvider: LyricsProvider = {
  async getLyrics(songId: string): Promise<LyricLine[] | null> {
    try {
      const response = await apiClient.getLyrics(songId);
      return response?.lines ?? null;
    } catch {
      return null;
    }
  },
};

/**
 * Deterministic placeholder used by component tests only — never by the
 * running app. Kept here so the rendering contract stays stable.
 */
export const mockLyricsProvider: LyricsProvider = {
  async getLyrics(_songId: string): Promise<LyricLine[] | null> {
    return [
      { timeSeconds: 0, text: "♪ Instrumental intro ♪" },
      { timeSeconds: 8, text: "Lyrics aren't available for this track yet" },
      { timeSeconds: 16, text: "This view is wired up and ready" },
      { timeSeconds: 24, text: "for real synced lyrics in a future phase" },
    ];
  },
};
