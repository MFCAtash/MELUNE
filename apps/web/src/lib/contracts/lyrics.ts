// Contract only. No song in the catalog has real synced lyrics yet —
// that needs a `lyrics` table/field and an upload path, which belongs
// to a future catalog-enrichment phase, not Phase 4. FullScreenPlayer
// depends only on this shape, so wiring up a real provider later means
// implementing this interface and swapping `mockLyricsProvider` for
// it — zero changes to any component that renders lyrics.

export interface LyricLine {
  timeSeconds: number;
  text: string;
}

export interface LyricsProvider {
  getLyrics(songId: string): Promise<LyricLine[] | null>;
}

/**
 * Clearly-labeled placeholder — returns the same few generic lines for
 * every song so the karaoke-style UI can be built and tested now. This
 * is UI scaffolding, not a claim that these are a song's real lyrics.
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
