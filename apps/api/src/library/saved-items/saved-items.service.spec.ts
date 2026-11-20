import { NotFoundException } from "@nestjs/common";
import { SavedItemsService } from "./saved-items.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("SavedItemsService", () => {
  let service: SavedItemsService;
  let prisma: {
    album: { findUnique: jest.Mock };
    artist: { findUnique: jest.Mock };
    playlist: { findUnique: jest.Mock };
    libraryItem: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      album: { findUnique: jest.fn() },
      artist: { findUnique: jest.fn() },
      playlist: { findUnique: jest.fn() },
      libraryItem: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    service = new SavedItemsService(prisma as unknown as PrismaService);
  });

  describe("save", () => {
    it("throws NotFoundException when the album doesn't exist", async () => {
      prisma.album.findUnique.mockResolvedValue(null);
      await expect(service.save("user-1", "album", "album-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.libraryItem.upsert).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a soft-deleted artist", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: new Date() });
      await expect(service.save("user-1", "artist", "artist-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws NotFoundException when the playlist doesn't exist", async () => {
      prisma.playlist.findUnique.mockResolvedValue(null);
      await expect(service.save("user-1", "playlist", "playlist-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("upserts on the album-specific unique constraint", async () => {
      prisma.album.findUnique.mockResolvedValue({ id: "album-1", deletedAt: null });
      await service.save("user-1", "album", "album-1");

      expect(prisma.libraryItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_albumId: { userId: "user-1", albumId: "album-1" } },
        }),
      );
    });

    it("upserts on the artist-specific unique constraint", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: null });
      await service.save("user-1", "artist", "artist-1");

      expect(prisma.libraryItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_artistId: { userId: "user-1", artistId: "artist-1" } },
        }),
      );
    });

    it("upserts on the playlist-specific unique constraint", async () => {
      prisma.playlist.findUnique.mockResolvedValue({ id: "playlist-1", deletedAt: null });
      await service.save("user-1", "playlist", "playlist-1");

      expect(prisma.libraryItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_playlistId: { userId: "user-1", playlistId: "playlist-1" } },
        }),
      );
    });
  });

  describe("unsave", () => {
    it("deletes by the album-specific filter", async () => {
      await service.unsave("user-1", "album", "album-1");
      expect(prisma.libraryItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", albumId: "album-1" },
      });
    });

    it("deletes by the artist-specific filter", async () => {
      await service.unsave("user-1", "artist", "artist-1");
      expect(prisma.libraryItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", artistId: "artist-1" },
      });
    });

    it("deletes by the playlist-specific filter", async () => {
      await service.unsave("user-1", "playlist", "playlist-1");
      expect(prisma.libraryItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", playlistId: "playlist-1" },
      });
    });
  });

  describe("findMine", () => {
    it("filters by itemType only when a type is given", async () => {
      prisma.libraryItem.findMany.mockResolvedValue([]);
      prisma.libraryItem.count.mockResolvedValue(0);

      await service.findMine("user-1", undefined, { page: 1, limit: 20, skip: 0 } as never);
      expect(prisma.libraryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1" } }),
      );

      await service.findMine("user-1", "album", { page: 1, limit: 20, skip: 0 } as never);
      expect(prisma.libraryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1", itemType: "ALBUM" } }),
      );
    });
  });
});
