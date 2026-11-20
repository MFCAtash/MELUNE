import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ArtistsService } from "../artists/artists.service";

describe("AlbumsService", () => {
  let service: AlbumsService;
  let prisma: {
    album: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    artist: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let artists: { findByUserId: jest.Mock; assertOwnership: jest.Mock };

  const ownerArtist = { id: "artist-1", userId: "user-1" };

  beforeEach(() => {
    prisma = {
      album: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      artist: { findUnique: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    artists = { findByUserId: jest.fn(), assertOwnership: jest.fn() };
    service = new AlbumsService(prisma as unknown as PrismaService, artists as unknown as ArtistsService);
  });

  describe("findOne", () => {
    it("throws NotFoundException when nothing matches", async () => {
      prisma.album.findFirst.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("createForUser", () => {
    it("throws NotFoundException without an artist profile", async () => {
      artists.findByUserId.mockResolvedValue(null);
      await expect(
        service.createForUser("user-1", { title: "Album" } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("creates the album under the caller's own artist", async () => {
      artists.findByUserId.mockResolvedValue(ownerArtist);
      prisma.album.create.mockResolvedValue({ id: "album-1" });

      await service.createForUser("user-1", { title: "Album" } as never);

      expect(prisma.album.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ artistId: "artist-1" }) }),
      );
    });

    it("parses an optional releaseDate into a Date", async () => {
      artists.findByUserId.mockResolvedValue(ownerArtist);
      prisma.album.create.mockResolvedValue({ id: "album-1" });

      await service.createForUser("user-1", {
        title: "Album",
        releaseDate: "2024-01-15",
      } as never);

      const dataArg = prisma.album.create.mock.calls[0][0].data;
      expect(dataArg.releaseDate).toBeInstanceOf(Date);
    });
  });

  describe("createByAdmin", () => {
    it("requires an explicit artistId", async () => {
      await expect(service.createByAdmin({ title: "Album" } as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects a soft-deleted or missing artist", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: new Date() });
      await expect(
        service.createByAdmin({ title: "Album", artistId: "artist-1" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates the album under the explicitly chosen artist", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: null });
      prisma.album.create.mockResolvedValue({ id: "album-1" });

      await service.createByAdmin({ title: "Album", artistId: "artist-1" } as never);

      expect(prisma.album.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ artistId: "artist-1" }) }),
      );
    });
  });

  describe("update / remove ownership", () => {
    const existingAlbum = { id: "album-1", artistId: "artist-1", artist: ownerArtist };

    it("throws NotFoundException for a missing or soft-deleted album", async () => {
      prisma.album.findUnique.mockResolvedValue(null);
      await expect(service.update("album-1", "user-1", false, {} as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("blocks a non-owning, non-admin caller from updating", async () => {
      prisma.album.findUnique.mockResolvedValue(existingAlbum);
      artists.assertOwnership.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(
        service.update("album-1", "intruder", false, { title: "x" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("strips artistId from the update payload", async () => {
      prisma.album.findUnique.mockResolvedValue(existingAlbum);
      prisma.album.update.mockResolvedValue({ ...existingAlbum, title: "New Title" });

      await service.update("album-1", "user-1", false, {
        artistId: "someone-else",
        title: "New Title",
      } as never);

      const dataArg = prisma.album.update.mock.calls[0][0].data;
      expect(dataArg).not.toHaveProperty("artistId");
    });

    it("lets an admin remove an album they don't own", async () => {
      prisma.album.findUnique.mockResolvedValue(existingAlbum);
      prisma.album.update.mockResolvedValue({});

      await service.remove("album-1", "some-admin", true);

      expect(artists.assertOwnership).toHaveBeenCalledWith("user-1", "some-admin", true);
      expect(prisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
