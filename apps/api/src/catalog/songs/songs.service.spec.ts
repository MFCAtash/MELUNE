import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { SongsService } from "./songs.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ArtistsService } from "../artists/artists.service";
import { CacheService } from "../../redis/cache.service";
import { StorageService } from "../../storage/storage.service";
import { NotificationsService } from "../../notifications/notifications.service";

describe("SongsService", () => {
  let service: SongsService;
  let prisma: {
    song: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    artist: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    album: { findUnique: jest.Mock };
    genre: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let artists: { findByUserId: jest.Mock; assertOwnership: jest.Mock };
  let cache: { getOrSet: jest.Mock; delByPrefix: jest.Mock };
  let storage: { keyFromPublicUrl: jest.Mock; deleteObject: jest.Mock; transcodeAudio: jest.Mock };
  let notifications: { notifyNewRelease: jest.Mock };

  const ownerArtist = { id: "artist-1", userId: "user-1", name: "Artist One" };

  beforeEach(() => {
    prisma = {
      song: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      artist: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(ownerArtist),
      },
      album: { findUnique: jest.fn() },
      genre: { findUnique: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    artists = {
      findByUserId: jest.fn(),
      assertOwnership: jest.fn(),
    };
    cache = {
      getOrSet: jest.fn((_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
      delByPrefix: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      keyFromPublicUrl: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      transcodeAudio: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { notifyNewRelease: jest.fn().mockResolvedValue(undefined) };

    service = new SongsService(
      prisma as unknown as PrismaService,
      artists as unknown as ArtistsService,
      cache as unknown as CacheService,
      storage as unknown as StorageService,
      notifications as unknown as NotificationsService,
    );
  });

  describe("findAll", () => {
    it("reads through the cache and shapes a paginated result", async () => {
      prisma.song.findMany.mockResolvedValue([{ id: "song-1" }]);
      prisma.song.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20, skip: 0 } as never);

      expect(cache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining("songs:list:"),
        60,
        expect.any(Function),
      );
      expect(result).toEqual({
        items: [{ id: "song-1" }],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("scopes the where clause to the provided filters", async () => {
      prisma.song.findMany.mockResolvedValue([]);
      prisma.song.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        artistId: "artist-9",
        albumId: "album-9",
        genreId: "genre-9",
      } as never);

      expect(prisma.song.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, artistId: "artist-9", albumId: "album-9", genreId: "genre-9" },
        }),
      );
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when the song doesn't exist", async () => {
      prisma.song.findFirst.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns the song when found by id or slug", async () => {
      prisma.song.findFirst.mockResolvedValue({ id: "song-1", slug: "song-one" });
      const result = await service.findOne("song-one");
      expect(result).toEqual({ id: "song-1", slug: "song-one" });
    });
  });

  describe("createForUser", () => {
    it("throws NotFoundException when the caller has no artist profile", async () => {
      artists.findByUserId.mockResolvedValue(null);
      await expect(
        service.createForUser("user-1", { title: "New Song" } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("creates a song under the caller's own artist profile", async () => {
      artists.findByUserId.mockResolvedValue(ownerArtist);
      prisma.song.create.mockResolvedValue({ id: "song-1", title: "New Song" });

      const result = await service.createForUser("user-1", {
        title: "New Song",
        duration: 120,
        audioUrl: "https://example.com/a.mp3",
      } as never);

      expect(prisma.song.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ artistId: "artist-1", title: "New Song" }) }),
      );
      expect(cache.delByPrefix).toHaveBeenCalledWith("songs:list:");
      expect(notifications.notifyNewRelease).toHaveBeenCalledWith(
        "artist-1",
        "Artist One",
        "song-1",
        "New Song",
      );
      expect(result).toEqual({ id: "song-1", title: "New Song" });
    });

    it("queues an HLS transcode job for audio stored in our own bucket", async () => {
      artists.findByUserId.mockResolvedValue(ownerArtist);
      prisma.song.create.mockResolvedValue({
        id: "song-1",
        title: "New Song",
        audioUrl: "https://cdn.example.com/melune/audio/artist-1/a.mp3",
      });
      storage.keyFromPublicUrl.mockReturnValue("audio/artist-1/a.mp3");

      await service.createForUser("user-1", {
        title: "New Song",
        duration: 120,
        audioUrl: "https://cdn.example.com/melune/audio/artist-1/a.mp3",
      } as never);

      expect(storage.transcodeAudio).toHaveBeenCalledWith("song-1", "audio/artist-1/a.mp3");
    });

    it("skips queuing a transcode for an externally-linked audioUrl", async () => {
      artists.findByUserId.mockResolvedValue(ownerArtist);
      prisma.song.create.mockResolvedValue({
        id: "song-1",
        title: "New Song",
        audioUrl: "https://other-host.example.com/a.mp3",
      });
      storage.keyFromPublicUrl.mockReturnValue(undefined);

      await service.createForUser("user-1", {
        title: "New Song",
        duration: 120,
        audioUrl: "https://other-host.example.com/a.mp3",
      } as never);

      expect(storage.transcodeAudio).not.toHaveBeenCalled();
    });

    it("rejects an albumId that doesn't belong to the caller's artist", async () => {
      artists.findByUserId.mockResolvedValue(ownerArtist);
      prisma.album.findUnique.mockResolvedValue({ id: "album-1", artistId: "someone-else", deletedAt: null });

      await expect(
        service.createForUser("user-1", { title: "New Song", albumId: "album-1" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a genreId that doesn't exist", async () => {
      artists.findByUserId.mockResolvedValue(ownerArtist);
      prisma.genre.findUnique.mockResolvedValue(null);

      await expect(
        service.createForUser("user-1", { title: "New Song", genreId: "ghost-genre" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("createByAdmin", () => {
    it("requires an explicit artistId", async () => {
      await expect(service.createByAdmin({ title: "New Song" } as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects an artistId that doesn't exist or is soft-deleted", async () => {
      prisma.artist.findUnique.mockResolvedValue(null);
      await expect(
        service.createByAdmin({ title: "New Song", artistId: "ghost" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: new Date() });
      await expect(
        service.createByAdmin({ title: "New Song", artistId: "artist-1" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates the song under the artistId chosen explicitly by the admin", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: null });
      prisma.song.create.mockResolvedValue({ id: "song-9" });

      await service.createByAdmin({ title: "Admin Song", artistId: "artist-1" } as never);

      expect(prisma.song.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ artistId: "artist-1" }) }),
      );
    });
  });

  describe("update", () => {
    const existingSong = {
      id: "song-1",
      artistId: "artist-1",
      audioUrl: "https://example.com/old.mp3",
      coverUrl: null,
      artist: ownerArtist,
    };

    it("throws NotFoundException for a missing or soft-deleted song", async () => {
      prisma.song.findUnique.mockResolvedValue(null);
      await expect(service.update("song-1", "user-1", false, {} as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.song.findUnique.mockResolvedValue({ ...existingSong, deletedAt: new Date() });
      await expect(service.update("song-1", "user-1", false, {} as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("enforces ownership via ArtistsService.assertOwnership", async () => {
      prisma.song.findUnique.mockResolvedValue(existingSong);
      artists.assertOwnership.mockImplementation(() => {
        throw new ForbiddenException("You do not own this artist profile");
      });

      await expect(
        service.update("song-1", "someone-else", false, {} as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("strips artistId from the update payload — it's create-only", async () => {
      prisma.song.findUnique.mockResolvedValue(existingSong);
      prisma.song.update.mockResolvedValue({ ...existingSong, title: "Renamed" });

      await service.update("song-1", "user-1", false, {
        artistId: "someone-elses-artist",
        title: "Renamed",
      } as never);

      const dataArg = prisma.song.update.mock.calls[0][0].data;
      expect(dataArg).not.toHaveProperty("artistId");
      expect(dataArg.title).toBe("Renamed");
    });

    it("cleans up the old audio file when the URL is replaced", async () => {
      prisma.song.findUnique.mockResolvedValue(existingSong);
      prisma.song.update.mockResolvedValue({ ...existingSong, audioUrl: "https://example.com/new.mp3" });
      storage.keyFromPublicUrl.mockReturnValue("audio/old.mp3");

      await service.update("song-1", "user-1", false, {
        audioUrl: "https://example.com/new.mp3",
      } as never);

      expect(storage.deleteObject).toHaveBeenCalledWith("audio/old.mp3");
    });

    it("does not attempt cleanup when the URL field is left unchanged", async () => {
      prisma.song.findUnique.mockResolvedValue(existingSong);
      prisma.song.update.mockResolvedValue(existingSong);

      await service.update("song-1", "user-1", false, { title: "Same URL" } as never);

      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it("lets an admin update a song they don't own", async () => {
      prisma.song.findUnique.mockResolvedValue(existingSong);
      prisma.song.update.mockResolvedValue({ ...existingSong, title: "Admin edit" });

      await service.update("song-1", "some-admin", true, { title: "Admin edit" } as never);

      expect(artists.assertOwnership).toHaveBeenCalledWith("user-1", "some-admin", true);
      expect(prisma.song.update).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("soft-deletes and invalidates the list cache", async () => {
      prisma.song.findUnique.mockResolvedValue({
        id: "song-1",
        artistId: "artist-1",
        artist: ownerArtist,
      });
      prisma.song.update.mockResolvedValue({});

      await service.remove("song-1", "user-1", false);

      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: "song-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(cache.delByPrefix).toHaveBeenCalledWith("songs:list:");
    });

    it("blocks removal by a non-owner, non-admin caller", async () => {
      prisma.song.findUnique.mockResolvedValue({
        id: "song-1",
        artistId: "artist-1",
        artist: ownerArtist,
      });
      artists.assertOwnership.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.remove("song-1", "intruder", false)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.song.update).not.toHaveBeenCalled();
    });
  });
});
