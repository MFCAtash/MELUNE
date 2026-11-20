import { ConflictException, NotFoundException } from "@nestjs/common";
import { GenresService } from "./genres.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("GenresService", () => {
  let service: GenresService;
  let prisma: {
    genre: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      genre: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new GenresService(prisma as unknown as PrismaService);
  });

  describe("findOne", () => {
    it("throws NotFoundException when nothing matches", async () => {
      prisma.genre.findFirst.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("create", () => {
    it("rejects a duplicate name", async () => {
      prisma.genre.findUnique.mockResolvedValue({ id: "genre-1", name: "Jazz" });
      await expect(service.create({ name: "Jazz" } as never)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.genre.create).not.toHaveBeenCalled();
    });

    it("creates a genre with a derived slug", async () => {
      prisma.genre.findUnique.mockResolvedValue(null);
      prisma.genre.create.mockResolvedValue({ id: "genre-1", name: "Lo-Fi Hip Hop", slug: "lo-fi-hip-hop" });

      await service.create({ name: "Lo-Fi Hip Hop" } as never);

      expect(prisma.genre.create).toHaveBeenCalledWith({
        data: { name: "Lo-Fi Hip Hop", slug: "lo-fi-hip-hop" },
      });
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the genre doesn't exist", async () => {
      prisma.genre.findFirst.mockResolvedValue(null);
      await expect(service.update("missing", { name: "x" } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.genre.update).not.toHaveBeenCalled();
    });

    it("re-derives the slug when the name changes", async () => {
      prisma.genre.findFirst.mockResolvedValue({ id: "genre-1", name: "Old" });
      prisma.genre.update.mockResolvedValue({ id: "genre-1", name: "New Wave", slug: "new-wave" });

      await service.update("genre-1", { name: "New Wave" } as never);

      expect(prisma.genre.update).toHaveBeenCalledWith({
        where: { id: "genre-1" },
        data: { name: "New Wave", slug: "new-wave" },
      });
    });
  });

  describe("remove", () => {
    it("throws NotFoundException before attempting delete", async () => {
      prisma.genre.findFirst.mockResolvedValue(null);
      await expect(service.remove("missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.genre.delete).not.toHaveBeenCalled();
    });

    it("deletes an existing genre", async () => {
      prisma.genre.findFirst.mockResolvedValue({ id: "genre-1" });
      await service.remove("genre-1");
      expect(prisma.genre.delete).toHaveBeenCalledWith({ where: { id: "genre-1" } });
    });
  });
});
