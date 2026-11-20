import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ArtistsService } from "./artists.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("ArtistsService", () => {
  let service: ArtistsService;
  let prisma: {
    artist: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      artist: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    service = new ArtistsService(prisma as unknown as PrismaService);
  });

  describe("createForUser", () => {
    it("rejects a second profile for the same user", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", userId: "user-1" });

      await expect(
        service.createForUser("user-1", { name: "New Name" } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.artist.create).not.toHaveBeenCalled();
    });

    it("creates a profile linked to the caller when none exists", async () => {
      prisma.artist.findUnique.mockResolvedValue(null);
      prisma.artist.create.mockResolvedValue({ id: "artist-1" });

      await service.createForUser("user-1", { name: "Fresh Artist" } as never);

      expect(prisma.artist.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", name: "Fresh Artist" }) }),
      );
    });
  });

  describe("createByAdmin", () => {
    it("creates a catalog-only profile with no linked user", async () => {
      prisma.artist.create.mockResolvedValue({ id: "artist-1", userId: null });

      await service.createByAdmin({ name: "Ghost Artist" } as never);

      const dataArg = prisma.artist.create.mock.calls[0][0].data;
      expect(dataArg).not.toHaveProperty("userId");
    });
  });

  describe("updateOwn", () => {
    it("throws NotFoundException when the caller has no profile", async () => {
      prisma.artist.findUnique.mockResolvedValue(null);
      await expect(service.updateOwn("user-1", { name: "x" } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("throws NotFoundException for a missing or soft-deleted artist", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: new Date() });
      await expect(service.update("artist-1", { name: "x" } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("soft-deletes an existing artist", async () => {
      prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", deletedAt: null });
      prisma.artist.update.mockResolvedValue({});

      await service.remove("artist-1");

      expect(prisma.artist.update).toHaveBeenCalledWith({
        where: { id: "artist-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("throws NotFoundException when already removed", async () => {
      prisma.artist.findUnique.mockResolvedValue(null);
      await expect(service.remove("artist-1")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("assertOwnership", () => {
    it("allows an admin regardless of ownership", () => {
      expect(() => service.assertOwnership("someone-else", "requester", true)).not.toThrow();
    });

    it("allows the owning user", () => {
      expect(() => service.assertOwnership("user-1", "user-1", false)).not.toThrow();
    });

    it("blocks a non-owning, non-admin user", () => {
      expect(() => service.assertOwnership("user-1", "user-2", false)).toThrow(ForbiddenException);
    });

    it("blocks a non-admin against a catalog-only profile (null userId)", () => {
      expect(() => service.assertOwnership(null, "user-2", false)).toThrow(ForbiddenException);
    });
  });

  describe("uniqueSlug (via createForUser)", () => {
    it("appends a numeric suffix when the base slug is taken", async () => {
      prisma.artist.findUnique.mockResolvedValue(null);
      prisma.artist.findFirst
        .mockResolvedValueOnce({ id: "existing" }) // "the-band" taken
        .mockResolvedValueOnce(null); // "the-band-2" free
      prisma.artist.create.mockResolvedValue({ id: "artist-2" });

      await service.createForUser("user-2", { name: "The Band" } as never);

      const dataArg = prisma.artist.create.mock.calls[0][0].data;
      expect(dataArg.slug).toBe("the-band-2");
    });
  });
});
