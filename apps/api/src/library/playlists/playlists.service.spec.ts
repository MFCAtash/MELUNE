import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PlaylistsService } from "./playlists.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("PlaylistsService", () => {
  let service: PlaylistsService;
  let prisma: {
    playlist: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    song: { findUnique: jest.Mock };
    playlistSong: { findFirst: jest.Mock; create: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      playlist: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      song: { findUnique: jest.fn() },
      playlistSong: {
        findFirst: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    service = new PlaylistsService(prisma as unknown as PrismaService);
  });

  describe("findOne", () => {
    it("throws NotFoundException when nothing matches", async () => {
      prisma.playlist.findFirst.mockResolvedValue(null);
      await expect(service.findOne("missing", "user-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("hides a private playlist from a non-owner as a 404 (not a 403)", async () => {
      prisma.playlist.findFirst.mockResolvedValue({
        id: "playlist-1",
        isPublic: false,
        ownerId: "owner-1",
      });

      await expect(service.findOne("playlist-1", "someone-else")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns a private playlist to its owner", async () => {
      const playlist = { id: "playlist-1", isPublic: false, ownerId: "owner-1" };
      prisma.playlist.findFirst.mockResolvedValue(playlist);

      await expect(service.findOne("playlist-1", "owner-1")).resolves.toBe(playlist);
    });

    it("returns a public playlist to anyone, including anonymous callers", async () => {
      const playlist = { id: "playlist-1", isPublic: true, ownerId: "owner-1" };
      prisma.playlist.findFirst.mockResolvedValue(playlist);

      await expect(service.findOne("playlist-1", undefined)).resolves.toBe(playlist);
    });
  });

  describe("create", () => {
    it("defaults isPublic to true when not provided", async () => {
      prisma.playlist.create.mockResolvedValue({ id: "playlist-1" });

      await service.create("user-1", { title: "My Mix" } as never);

      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPublic: true, ownerId: "user-1" }) }),
      );
    });

    it("respects an explicit isPublic: false", async () => {
      prisma.playlist.create.mockResolvedValue({ id: "playlist-1" });

      await service.create("user-1", { title: "Private Mix", isPublic: false } as never);

      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPublic: false }) }),
      );
    });
  });

  describe("ownership enforcement", () => {
    it("update: throws NotFoundException for a missing/soft-deleted playlist", async () => {
      prisma.playlist.findUnique.mockResolvedValue(null);
      await expect(service.update("playlist-1", "user-1", {} as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("update: throws ForbiddenException for a non-owner", async () => {
      prisma.playlist.findUnique.mockResolvedValue({ id: "playlist-1", ownerId: "owner-1", deletedAt: null });
      await expect(
        service.update("playlist-1", "intruder", { title: "x" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("remove: soft-deletes only when the caller owns the playlist", async () => {
      prisma.playlist.findUnique.mockResolvedValue({ id: "playlist-1", ownerId: "owner-1", deletedAt: null });
      prisma.playlist.update.mockResolvedValue({});

      await service.remove("playlist-1", "owner-1");

      expect(prisma.playlist.update).toHaveBeenCalledWith({
        where: { id: "playlist-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe("addSong", () => {
    const ownedPlaylist = { id: "playlist-1", ownerId: "user-1", deletedAt: null };

    it("throws NotFoundException when the song doesn't exist", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.song.findUnique.mockResolvedValue(null);

      await expect(service.addSong("playlist-1", "user-1", "song-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("places a new song at position 0 for an empty playlist", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.song.findUnique.mockResolvedValue({ id: "song-1", deletedAt: null });
      prisma.playlistSong.findFirst.mockResolvedValue(null);
      prisma.playlistSong.create.mockResolvedValue({ position: 0 });

      await service.addSong("playlist-1", "user-1", "song-1");

      expect(prisma.playlistSong.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ position: 0 }) }),
      );
    });

    it("appends after the current last position", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.song.findUnique.mockResolvedValue({ id: "song-2", deletedAt: null });
      prisma.playlistSong.findFirst.mockResolvedValue({ position: 4 });
      prisma.playlistSong.create.mockResolvedValue({ position: 5 });

      await service.addSong("playlist-1", "user-1", "song-2");

      expect(prisma.playlistSong.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ position: 5 }) }),
      );
    });

    it("translates a unique-constraint failure into a friendly BadRequestException", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.song.findUnique.mockResolvedValue({ id: "song-1", deletedAt: null });
      prisma.playlistSong.findFirst.mockResolvedValue(null);
      prisma.playlistSong.create.mockRejectedValue(new Error("Unique constraint failed"));

      await expect(service.addSong("playlist-1", "user-1", "song-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("blocks a non-owner from adding songs", async () => {
      prisma.playlist.findUnique.mockResolvedValue({ id: "playlist-1", ownerId: "owner-1", deletedAt: null });

      await expect(service.addSong("playlist-1", "intruder", "song-1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.song.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("reorder", () => {
    const ownedPlaylist = { id: "playlist-1", ownerId: "user-1", deletedAt: null };

    it("accepts a permutation of the exact current song set", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.playlistSong.findMany.mockResolvedValue([{ songId: "a" }, { songId: "b" }, { songId: "c" }]);

      await service.reorder("playlist-1", "user-1", ["c", "a", "b"]);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.playlistSong.update).toHaveBeenCalledTimes(3);
      expect(prisma.playlistSong.update).toHaveBeenCalledWith({
        where: { playlistId_songId: { playlistId: "playlist-1", songId: "c" } },
        data: { position: 0 },
      });
    });

    it("rejects a songIds list that drops an existing song", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.playlistSong.findMany.mockResolvedValue([{ songId: "a" }, { songId: "b" }]);

      await expect(service.reorder("playlist-1", "user-1", ["a"])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects a songIds list that adds a song not in the playlist", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.playlistSong.findMany.mockResolvedValue([{ songId: "a" }]);

      await expect(service.reorder("playlist-1", "user-1", ["a", "ghost"])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects a duplicated song id even if the set size matches", async () => {
      prisma.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prisma.playlistSong.findMany.mockResolvedValue([{ songId: "a" }, { songId: "b" }]);

      // ["a", "a"] has size 2 as a plain array but collapses to size 1 as a Set,
      // so it must be rejected against the real 2-song playlist.
      await expect(service.reorder("playlist-1", "user-1", ["a", "a"])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("blocks reordering by a non-owner", async () => {
      prisma.playlist.findUnique.mockResolvedValue({ id: "playlist-1", ownerId: "owner-1", deletedAt: null });

      await expect(service.reorder("playlist-1", "intruder", ["a"])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
