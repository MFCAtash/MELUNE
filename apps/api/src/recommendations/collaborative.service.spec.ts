import { CollaborativeService } from "./collaborative.service";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";

describe("CollaborativeService", () => {
  let service: CollaborativeService;
  let prisma: {
    like: { findMany: jest.Mock };
    listeningHistory: { findMany: jest.Mock };
  };
  let cache: CacheService;

  beforeEach(() => {
    prisma = {
      like: { findMany: jest.fn() },
      listeningHistory: { findMany: jest.fn() },
    };
    cache = { getOrSet: jest.fn((_key, _ttl, loader) => loader()) } as unknown as CacheService;
    service = new CollaborativeService(prisma as unknown as PrismaService, cache);
  });

  it("returns basis 'none' when the user has no likes or history", async () => {
    prisma.like.findMany.mockResolvedValue([]);
    prisma.listeningHistory.findMany.mockResolvedValue([]);

    const result = await service.getSimilar("user-1", 20);

    expect(result).toEqual({ scored: [], basis: "none" });
  });

  it("returns basis 'none' when fewer than MIN_NEIGHBORS other users overlap", async () => {
    // Seed pass: user liked one song.
    prisma.like.findMany
      .mockResolvedValueOnce([{ songId: "seed-1" }]) // loadSeedInteractions.likes
      .mockResolvedValueOnce([{ userId: "neighbor-1", songId: "seed-1" }]); // findNeighbors.likeRows
    prisma.listeningHistory.findMany
      .mockResolvedValueOnce([]) // loadSeedInteractions.history
      .mockResolvedValueOnce([]); // findNeighbors.historyRows

    const result = await service.getSimilar("user-1", 20);

    // Only one overlapping neighbor found — below MIN_NEIGHBORS (3).
    expect(result).toEqual({ scored: [], basis: "none" });
  });

  it("ranks a candidate liked by overlapping neighbors above the user's own seed songs", async () => {
    // Seed: the user liked "seed-1".
    prisma.like.findMany
      .mockResolvedValueOnce([{ songId: "seed-1" }]) // loadSeedInteractions.likes
      .mockResolvedValueOnce([
        // findNeighbors.likeRows — three neighbors also liked "seed-1"
        { userId: "n1", songId: "seed-1" },
        { userId: "n2", songId: "seed-1" },
        { userId: "n3", songId: "seed-1" },
      ])
      .mockResolvedValueOnce([
        // loadNeighborInteractions.likeRows — this query is *not* scoped
        // to seed songs, so it naturally includes each neighbor's own
        // like of "seed-1" again, plus their other likes: all three also
        // liked "candidate-1", only one liked "candidate-2".
        { userId: "n1", songId: "seed-1" },
        { userId: "n2", songId: "seed-1" },
        { userId: "n3", songId: "seed-1" },
        { userId: "n1", songId: "candidate-1" },
        { userId: "n2", songId: "candidate-1" },
        { userId: "n3", songId: "candidate-1" },
        { userId: "n1", songId: "candidate-2" },
      ]);
    prisma.listeningHistory.findMany
      .mockResolvedValueOnce([]) // loadSeedInteractions.history
      .mockResolvedValueOnce([]) // findNeighbors.historyRows
      .mockResolvedValueOnce([]); // loadNeighborInteractions.historyRows

    const result = await service.getSimilar("user-1", 20);

    expect(result.basis).toBe("collaborative");
    expect(result.scored[0].songId).toBe("candidate-1");
    expect(result.scored.some((s) => s.songId === "candidate-2")).toBe(true);
    expect(result.scored[0].score).toBeGreaterThan(
      result.scored.find((s) => s.songId === "candidate-2")!.score,
    );
    // Every returned candidate must be a strictly positive match — never
    // the user's own seed songs re-surfaced as a "recommendation".
    expect(result.scored.every((s) => s.songId !== "seed-1")).toBe(true);
  });

  it("returns basis 'none' when neighbors exist but have no other interactions to recommend", async () => {
    prisma.like.findMany
      .mockResolvedValueOnce([{ songId: "seed-1" }])
      .mockResolvedValueOnce([
        { userId: "n1", songId: "seed-1" },
        { userId: "n2", songId: "seed-1" },
        { userId: "n3", songId: "seed-1" },
      ])
      .mockResolvedValueOnce([]); // loadNeighborInteractions.likeRows — nothing else
    prisma.listeningHistory.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getSimilar("user-1", 20);

    expect(result).toEqual({ scored: [], basis: "none" });
  });

  it("caches results through CacheService.getOrSet", async () => {
    prisma.like.findMany.mockResolvedValue([]);
    prisma.listeningHistory.findMany.mockResolvedValue([]);

    await service.getSimilar("user-1", 15);

    expect(cache.getOrSet).toHaveBeenCalledWith(
      "recs:collab:user-1:15",
      expect.any(Number),
      expect.any(Function),
    );
  });
});
