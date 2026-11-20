import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";

describe("AdminService", () => {
  let service: AdminService;
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let cache: { del: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    cache = { del: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(prisma as unknown as PrismaService, cache as unknown as CacheService);
  });

  it("evicts the cached auth status when a user is banned", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-2" });
    prisma.user.update.mockResolvedValue({ id: "user-2", artistProfile: null });

    await service.banUser("admin-1", "user-2");

    expect(cache.del).toHaveBeenCalledWith(expect.stringContaining("user-2"));
  });

  it("refuses to let an admin demote their own account", async () => {
    await expect(
      service.updateRole("admin-1", "admin-1", { role: "USER" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("allows an admin to change someone else's role", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-2" });
    prisma.user.update.mockResolvedValue({
      id: "user-2",
      role: "ARTIST",
      artistProfile: null,
    });

    const result = await service.updateRole("admin-1", "user-2", { role: "ARTIST" });

    expect(result.role).toBe("ARTIST");
    expect(result.isArtist).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-2" }, data: { role: "ARTIST" } }),
    );
  });

  it("refuses to let an admin ban their own account", async () => {
    await expect(service.banUser("admin-1", "admin-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("bans a user and revokes their active refresh tokens", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-2" });
    prisma.user.update.mockResolvedValue({ id: "user-2", artistProfile: null });

    await service.banUser("admin-1", "user-2");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-2", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("throws NotFoundException when banning a user that doesn't exist", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.banUser("admin-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
