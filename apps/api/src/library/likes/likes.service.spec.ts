import { NotFoundException } from "@nestjs/common";
import { LikesService } from "./likes.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("LikesService", () => {
  let service: LikesService;
  let prisma: {
    song: { findUnique: jest.Mock };
    like: { upsert: jest.Mock; deleteMany: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      song: { findUnique: jest.fn() },
      like: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    service = new LikesService(prisma as unknown as PrismaService);
  });

  describe("like", () => {
    it("throws NotFoundException for a missing or soft-deleted song", async () => {
      prisma.song.findUnique.mockResolvedValue(null);
      await expect(service.like("user-1", "song-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.like.upsert).not.toHaveBeenCalled();

      prisma.song.findUnique.mockResolvedValue({ id: "song-1", deletedAt: new Date() });
      await expect(service.like("user-1", "song-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("upserts so liking twice is a no-op, not an error", async () => {
      prisma.song.findUnique.mockResolvedValue({ id: "song-1", deletedAt: null });
      prisma.like.upsert.mockResolvedValue({});

      await service.like("user-1", "song-1");
      await service.like("user-1", "song-1");

      expect(prisma.like.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.like.upsert).toHaveBeenCalledWith({
        where: { userId_songId: { userId: "user-1", songId: "song-1" } },
        create: { userId: "user-1", songId: "song-1" },
        update: {},
      });
    });
  });

  describe("unlike", () => {
    it("is a no-op deleteMany even if nothing was liked", async () => {
      prisma.like.deleteMany.mockResolvedValue({ count: 0 });
      await service.unlike("user-1", "song-1");
      expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", songId: "song-1" } });
    });
  });

  describe("isLiked", () => {
    it("returns true when a like row exists", async () => {
      prisma.like.findUnique.mockResolvedValue({ userId: "user-1", songId: "song-1" });
      await expect(service.isLiked("user-1", "song-1")).resolves.toBe(true);
    });

    it("returns false when no like row exists", async () => {
      prisma.like.findUnique.mockResolvedValue(null);
      await expect(service.isLiked("user-1", "song-1")).resolves.toBe(false);
    });
  });

  describe("findMine", () => {
    it("maps rows down to their song and excludes soft-deleted songs", async () => {
      prisma.like.findMany.mockResolvedValue([{ song: { id: "song-1" } }, { song: { id: "song-2" } }]);
      prisma.like.count.mockResolvedValue(2);

      const result = await service.findMine("user-1", { page: 1, limit: 20, skip: 0 } as never);

      expect(prisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1", song: { deletedAt: null } } }),
      );
      expect(result.items).toEqual([{ id: "song-1" }, { id: "song-2" }]);
      expect(result.total).toBe(2);
    });
  });
});
