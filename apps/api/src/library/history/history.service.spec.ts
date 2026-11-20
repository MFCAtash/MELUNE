import { NotFoundException } from "@nestjs/common";
import { HistoryService } from "./history.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("HistoryService", () => {
  let service: HistoryService;
  let prisma: {
    song: { findUnique: jest.Mock };
    listeningHistory: { create: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    song2: unknown;
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      song: { findUnique: jest.fn() },
      listeningHistory: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      song2: undefined,
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    (prisma as unknown as { song: { update: jest.Mock } }).song.update = jest.fn();
    service = new HistoryService(prisma as unknown as PrismaService);
  });

  describe("recordPlay", () => {
    it("throws NotFoundException for a missing or soft-deleted song", async () => {
      prisma.song.findUnique.mockResolvedValue(null);
      await expect(service.recordPlay("user-1", "song-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();

      prisma.song.findUnique.mockResolvedValue({ id: "song-1", deletedAt: new Date() });
      await expect(service.recordPlay("user-1", "song-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("creates a history row and bumps playCount in one transaction", async () => {
      prisma.song.findUnique.mockResolvedValue({ id: "song-1", deletedAt: null });

      await service.recordPlay("user-1", "song-1");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.listeningHistory.create).toHaveBeenCalledWith({
        data: { userId: "user-1", songId: "song-1" },
      });
      expect((prisma as unknown as { song: { update: jest.Mock } }).song.update).toHaveBeenCalledWith({
        where: { id: "song-1" },
        data: { playCount: { increment: 1 } },
      });
    });
  });

  describe("recentSongIds", () => {
    it("dedupes repeated songs, keeping the most recent play", async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);
      prisma.listeningHistory.findMany.mockResolvedValue([
        { songId: "song-1", playedAt: now },
        { songId: "song-1", playedAt: earlier },
        { songId: "song-2", playedAt: earlier },
      ]);

      const result = await service.recentSongIds("user-1", 10);

      expect(result).toEqual([
        { songId: "song-1", lastPlayedAt: now },
        { songId: "song-2", lastPlayedAt: earlier },
      ]);
    });

    it("stops once `limit` distinct songs have been collected", async () => {
      prisma.listeningHistory.findMany.mockResolvedValue([
        { songId: "song-1", playedAt: new Date() },
        { songId: "song-2", playedAt: new Date() },
        { songId: "song-3", playedAt: new Date() },
      ]);

      const result = await service.recentSongIds("user-1", 2);

      expect(result).toHaveLength(2);
      expect(prisma.listeningHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }), // limit * 5
      );
    });
  });

  describe("topGenres", () => {
    it("counts plays per genre, ignoring songs with no genre, sorted descending", async () => {
      prisma.listeningHistory.findMany.mockResolvedValue([
        { song: { genreId: "rock" } },
        { song: { genreId: "rock" } },
        { song: { genreId: "jazz" } },
        { song: { genreId: null } },
      ]);

      const result = await service.topGenres("user-1", 5);

      expect(result).toEqual([
        { genreId: "rock", plays: 2 },
        { genreId: "jazz", plays: 1 },
      ]);
    });

    it("truncates to the requested limit", async () => {
      prisma.listeningHistory.findMany.mockResolvedValue([
        { song: { genreId: "a" } },
        { song: { genreId: "b" } },
        { song: { genreId: "c" } },
      ]);

      const result = await service.topGenres("user-1", 1);
      expect(result).toHaveLength(1);
    });
  });
});
