import { SearchService } from "./search.service";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";

describe("SearchService", () => {
  let service: SearchService;
  let prisma: {
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
    song: { findMany: jest.Mock };
    artist: { findMany: jest.Mock };
    album: { findMany: jest.Mock };
    playlist: { findMany: jest.Mock };
    searchHistory: { deleteMany: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  };
  let cache: { getOrSet: jest.Mock; get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
      song: { findMany: jest.fn().mockResolvedValue([]) },
      artist: { findMany: jest.fn().mockResolvedValue([]) },
      album: { findMany: jest.fn().mockResolvedValue([]) },
      playlist: { findMany: jest.fn().mockResolvedValue([]) },
      searchHistory: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    cache = {
      getOrSet: jest.fn((_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };

    service = new SearchService(prisma as unknown as PrismaService, cache as unknown as CacheService);
  });

  describe("quickSearch", () => {
    it("reads through the cache with a normalized key", async () => {
      await service.quickSearch("  Alb  ");

      expect(cache.getOrSet).toHaveBeenCalledWith("search:quick:alb", 30, expect.any(Function));
    });

    it("returns the cached preview without re-querying Postgres on a cache hit", async () => {
      const cachedResult = {
        query: "alb",
        songs: [{ id: "song-1" }],
        artists: [],
        albums: [],
        playlists: [],
      };
      cache.getOrSet.mockResolvedValueOnce(cachedResult);

      const result = await service.quickSearch("alb");

      expect(result).toEqual(cachedResult);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("fans out to all four search groups and shapes them into one preview", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: "song-1", total: 1n }])
        .mockResolvedValueOnce([{ id: "artist-1", total: 1n }])
        .mockResolvedValueOnce([{ id: "album-1", total: 1n }])
        .mockResolvedValueOnce([{ id: "playlist-1", total: 1n }]);
      prisma.song.findMany.mockResolvedValue([{ id: "song-1" }]);
      prisma.artist.findMany.mockResolvedValue([{ id: "artist-1" }]);
      prisma.album.findMany.mockResolvedValue([{ id: "album-1" }]);
      prisma.playlist.findMany.mockResolvedValue([{ id: "playlist-1" }]);

      const result = await service.quickSearch("alb");

      expect(result).toEqual({
        query: "alb",
        songs: [{ id: "song-1" }],
        artists: [{ id: "artist-1" }],
        albums: [{ id: "album-1" }],
        playlists: [{ id: "playlist-1" }],
      });
    });

    it("still runs (rather than short-circuiting) when the query is empty", async () => {
      const result = await service.quickSearch("");

      expect(cache.getOrSet).toHaveBeenCalledWith("search:quick:", 30, expect.any(Function));
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
      expect(result).toEqual({ query: "", songs: [], artists: [], albums: [], playlists: [] });
    });
  });

  describe("searchSongs", () => {
    it("paginates using the total count carried on the ranked rows", async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: "song-1", total: 42n },
        { id: "song-2", total: 42n },
      ]);
      prisma.song.findMany.mockResolvedValue([{ id: "song-1" }, { id: "song-2" }]);

      const result = await service.searchSongs("love", 2, 20);

      expect(result).toEqual({
        items: [{ id: "song-1" }, { id: "song-2" }],
        page: 2,
        limit: 20,
        total: 42,
        totalPages: 3,
      });
    });

    it("filters songs to the non-deleted set via the raw trigram/full-text query", async () => {
      await service.searchSongs("love", 1, 20);

      const [sqlParts] = prisma.$queryRaw.mock.calls[0];
      expect(sqlParts.join("")).toContain('s."deletedAt" IS NULL');
    });

    it("still ranks and returns a match despite a minor typo, via trigram similarity", async () => {
      // Simulates Postgres's `%`/similarity() operator tolerating "lvoe" -> "love".
      prisma.$queryRaw.mockResolvedValue([{ id: "song-1", total: 1n }]);
      prisma.song.findMany.mockResolvedValue([{ id: "song-1", title: "Love Song" }]);

      const result = await service.searchSongs("lvoe", 1, 20);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      const [, q] = prisma.$queryRaw.mock.calls[0];
      expect(q).toBe("lvoe");
      expect(result.items).toEqual([{ id: "song-1", title: "Love Song" }]);
    });

    it("returns an empty page without hydrating when nothing matches", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.searchSongs("zzzznotfound", 1, 20);

      expect(prisma.song.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    });

    it("preserves the ranked order returned by Postgres when hydrating records", async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: "song-2", total: 2n },
        { id: "song-1", total: 2n },
      ]);
      // Prisma's findMany with `id IN [...]` does not preserve input order.
      prisma.song.findMany.mockResolvedValue([{ id: "song-1" }, { id: "song-2" }]);

      const result = await service.searchSongs("love", 1, 20);

      expect(result.items).toEqual([{ id: "song-2" }, { id: "song-1" }]);
    });
  });

  describe("searchAlbums / typed filters", () => {
    it("scopes the raw query to the albums table only", async () => {
      await service.searchAlbums("kind of blue", 1, 20);

      const [sqlParts] = prisma.$queryRaw.mock.calls[0];
      const sql = sqlParts.join("");
      expect(sql).toContain("FROM albums al");
      expect(prisma.artist.findMany).not.toHaveBeenCalled();
      expect(prisma.playlist.findMany).not.toHaveBeenCalled();
    });
  });

  describe("searchPlaylists", () => {
    it("only ever queries public, non-deleted playlists", async () => {
      await service.searchPlaylists("chill", 1, 20);

      const [sqlParts] = prisma.$queryRaw.mock.calls[0];
      const sql = sqlParts.join("");
      expect(sql).toContain('p."isPublic" = true');
      expect(sql).toContain('p."deletedAt" IS NULL');
    });
  });

  describe("recordHistory", () => {
    it("deletes any prior row with the same text before inserting the fresh one", async () => {
      prisma.searchHistory.findMany.mockResolvedValue([]);

      await service.recordHistory("user-1", "daft punk");

      expect(prisma.$transaction).toHaveBeenCalledWith([
        expect.any(Promise),
        expect.any(Promise),
      ]);
      expect(prisma.searchHistory.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", query: "daft punk" },
      });
      expect(prisma.searchHistory.create).toHaveBeenCalledWith({
        data: { userId: "user-1", query: "daft punk" },
      });
    });

    it("prunes rows past the per-user cap after writing", async () => {
      prisma.searchHistory.findMany.mockResolvedValue([{ id: "old-1" }, { id: "old-2" }]);

      await service.recordHistory("user-1", "daft punk");

      expect(prisma.searchHistory.deleteMany).toHaveBeenLastCalledWith({
        where: { id: { in: ["old-1", "old-2"] } },
      });
    });

    it("does not issue a prune delete when there is nothing stale", async () => {
      prisma.searchHistory.findMany.mockResolvedValue([]);

      await service.recordHistory("user-1", "daft punk");

      expect(prisma.searchHistory.deleteMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("listHistory / clearHistory", () => {
    it("returns the most recent entries capped at the history limit", async () => {
      prisma.searchHistory.findMany.mockResolvedValue([{ id: "h-1" }]);

      const result = await service.listHistory("user-1");

      expect(prisma.searchHistory.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      expect(result).toEqual([{ id: "h-1" }]);
    });

    it("clears every history row for the user", async () => {
      await service.clearHistory("user-1");

      expect(prisma.searchHistory.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });
  });
});
