import { RecommendationsService } from "./recommendations.service";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";

function song(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "song-1",
    artistId: "artist-1",
    genreId: "genre-1",
    mood: null,
    bpm: null,
    energy: null,
    ...overrides,
  };
}

describe("RecommendationsService", () => {
  let service: RecommendationsService;
  let prisma: {
    like: { findMany: jest.Mock };
    listeningHistory: { findMany: jest.Mock };
    song: { findMany: jest.Mock };
  };
  let cache: CacheService;

  beforeEach(() => {
    prisma = {
      like: { findMany: jest.fn() },
      listeningHistory: { findMany: jest.fn() },
      song: { findMany: jest.fn() },
    };

    // getOrSet just runs the loader — no real Redis in this test.
    cache = { getOrSet: jest.fn((_key, _ttl, loader) => loader()) } as unknown as CacheService;

    service = new RecommendationsService(prisma as unknown as PrismaService, cache);
  });

  it("returns basis 'none' when the user has no likes or history", async () => {
    prisma.like.findMany.mockResolvedValue([]);
    prisma.listeningHistory.findMany.mockResolvedValue([]);

    const result = await service.getForYou("user-1", 20);

    expect(result.basis).toBe("none");
    expect(result.scored).toEqual([]);
    expect(prisma.song.findMany).not.toHaveBeenCalled();
  });

  it("ranks a same-genre, same-artist candidate above an unrelated one", async () => {
    prisma.like.findMany.mockResolvedValue([
      { song: song({ id: "liked-1", artistId: "artist-A", genreId: "genre-pop", mood: "chill", bpm: 100, energy: 0.4 }) },
    ]);
    prisma.listeningHistory.findMany.mockResolvedValue([]);

    prisma.song.findMany
      .mockResolvedValueOnce([
        song({ id: "close-match", artistId: "artist-A", genreId: "genre-pop", mood: "chill", bpm: 102, energy: 0.45 }),
        song({ id: "same-genre-only", artistId: "artist-B", genreId: "genre-pop", mood: null, bpm: null, energy: null }),
      ])
      // Fallback pass (primary < CANDIDATE_LIMIT) — nothing extra to add.
      .mockResolvedValueOnce([]);

    const result = await service.getForYou("user-1", 20);

    expect(result.basis).toBe("profile");
    expect(result.scored[0].songId).toBe("close-match");
    expect(result.scored[0].score).toBeGreaterThan(result.scored[1].score);
    // Neither candidate shares nothing at all with the profile, so both
    // should score strictly positive.
    expect(result.scored.every((s) => s.score > 0)).toBe(true);
  });

  it("excludes an unrelated candidate that shares no genre or artist", async () => {
    prisma.like.findMany.mockResolvedValue([
      { song: song({ id: "liked-1", artistId: "artist-A", genreId: "genre-pop" }) },
    ]);
    prisma.listeningHistory.findMany.mockResolvedValue([]);

    // The fallback candidate pass can surface songs outside the user's
    // genre/artist set (to fill out the page) — those must still be
    // filtered out by the score > 0 cutoff, not just deprioritized.
    prisma.song.findMany
      .mockResolvedValueOnce([]) // primary content-filtered pass: no matches
      .mockResolvedValueOnce([song({ id: "unrelated", artistId: "artist-Z", genreId: "genre-metal" })]);

    const result = await service.getForYou("user-1", 20);

    expect(result.scored).toEqual([]);
  });

  it("caches results through CacheService.getOrSet", async () => {
    prisma.like.findMany.mockResolvedValue([]);
    prisma.listeningHistory.findMany.mockResolvedValue([]);

    await service.getForYou("user-1", 10);

    expect(cache.getOrSet).toHaveBeenCalledWith(
      "recs:foryou:user-1:10",
      expect.any(Number),
      expect.any(Function),
    );
  });
});
