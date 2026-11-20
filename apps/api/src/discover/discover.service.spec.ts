import { DiscoverService } from "./discover.service";
import { PrismaService } from "../prisma/prisma.service";
import { HistoryService } from "../library/history/history.service";
import { CacheService } from "../redis/cache.service";
import { HybridRecommendationsService } from "../recommendations/hybrid-recommendations.service";

describe("DiscoverService", () => {
  let service: DiscoverService;
  let prisma: { song: { findMany: jest.Mock } };
  let history: { recentSongIds: jest.Mock };
  let cache: { getOrSet: jest.Mock };
  let recommendations: { getForYou: jest.Mock; hydrate: jest.Mock };

  const trendingSongs = [{ id: "trend-1" }, { id: "trend-2" }];

  beforeEach(() => {
    prisma = { song: { findMany: jest.fn() } };
    history = { recentSongIds: jest.fn() };
    cache = {
      getOrSet: jest.fn((_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
    };
    recommendations = {
      getForYou: jest.fn(),
      hydrate: jest.fn(),
    };

    prisma.song.findMany.mockResolvedValue(trendingSongs);

    service = new DiscoverService(
      prisma as unknown as PrismaService,
      history as unknown as HistoryService,
      cache as unknown as CacheService,
      recommendations as unknown as HybridRecommendationsService,
    );
  });

  describe("getHome — guest visitor", () => {
    it("returns trending only, with no history lookup or recommendations call", async () => {
      const result = await service.getHome(undefined);

      expect(result).toEqual({ recentlyPlayed: [], trending: trendingSongs, madeForYou: null });
      expect(history.recentSongIds).not.toHaveBeenCalled();
      expect(recommendations.getForYou).not.toHaveBeenCalled();
    });

    it("still reads trending through the shared cache key", async () => {
      await service.getHome(undefined);

      expect(cache.getOrSet).toHaveBeenCalledWith("discover:trending", 120, expect.any(Function));
    });
  });

  describe("getHome — logged-in user", () => {
    it("combines recentlyPlayed with madeForYou when the user has a recommendation profile", async () => {
      history.recentSongIds.mockResolvedValue([{ songId: "song-1" }, { songId: "song-2" }]);
      prisma.song.findMany
        .mockResolvedValueOnce(trendingSongs) // trending (via cache loader)
        .mockResolvedValueOnce([{ id: "song-2" }, { id: "song-1" }]); // hydrateOrdered, out of order on purpose
      recommendations.getForYou.mockResolvedValue({
        scored: [{ songId: "song-9", score: 0.9 }],
        basis: "profile",
      });
      recommendations.hydrate.mockResolvedValue([{ id: "song-9" }]);

      const result = await service.getHome("user-1");

      expect(history.recentSongIds).toHaveBeenCalledWith("user-1", 20);
      expect(recommendations.getForYou).toHaveBeenCalledWith("user-1", 20);
      expect(recommendations.hydrate).toHaveBeenCalledWith([{ songId: "song-9", score: 0.9 }]);
      expect(result).toEqual({
        // preserves recentSongIds' own order, not Prisma's findMany order
        recentlyPlayed: [{ id: "song-1" }, { id: "song-2" }],
        trending: trendingSongs,
        madeForYou: [{ id: "song-9" }],
      });
    });

    it("returns madeForYou: null (never a padded/backfilled list) when there's no profile yet", async () => {
      history.recentSongIds.mockResolvedValue([]);
      recommendations.getForYou.mockResolvedValue({ scored: [], basis: "none" });

      const result = await service.getHome("user-1");

      expect(recommendations.hydrate).not.toHaveBeenCalled();
      expect(result.madeForYou).toBeNull();
      expect(result.recentlyPlayed).toEqual([]);
    });

    it("skips hydrating recentlyPlayed entirely when there's no listening history", async () => {
      history.recentSongIds.mockResolvedValue([]);
      recommendations.getForYou.mockResolvedValue({ scored: [], basis: "none" });

      await service.getHome("user-1");

      // Only the trending call should have hit song.findMany.
      expect(prisma.song.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
