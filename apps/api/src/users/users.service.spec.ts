import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";

describe("UsersService.getStats", () => {
  let service: UsersService;
  let prisma: {
    like: { count: jest.Mock };
    playlist: { count: jest.Mock };
    listeningHistory: { count: jest.Mock };
  };
  let cache: CacheService;

  beforeEach(() => {
    prisma = {
      like: { count: jest.fn() },
      playlist: { count: jest.fn() },
      listeningHistory: { count: jest.fn() },
    };

    // getOrSet just runs the loader — no real Redis in this test.
    cache = { getOrSet: jest.fn((_key, _ttl, loader) => loader()) } as unknown as CacheService;

    service = new UsersService(prisma as unknown as PrismaService, cache);
  });

  it("returns likes/playlists/plays counts scoped to the user", async () => {
    prisma.like.count.mockResolvedValue(12);
    prisma.playlist.count.mockResolvedValue(3);
    prisma.listeningHistory.count.mockResolvedValue(240);

    const result = await service.getStats("user-1");

    expect(result).toEqual({ likes: 12, playlists: 3, plays: 240 });
    expect(prisma.like.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prisma.playlist.count).toHaveBeenCalledWith({
      where: { ownerId: "user-1", deletedAt: null },
    });
    expect(prisma.listeningHistory.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("caches under a per-user key with a 5-minute TTL", async () => {
    prisma.like.count.mockResolvedValue(0);
    prisma.playlist.count.mockResolvedValue(0);
    prisma.listeningHistory.count.mockResolvedValue(0);

    await service.getStats("user-2");

    expect(cache.getOrSet).toHaveBeenCalledWith("user:user-2:stats", 300, expect.any(Function));
  });
});
