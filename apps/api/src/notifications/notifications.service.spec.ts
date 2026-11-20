import { NotFoundException } from "@nestjs/common";
import { NotificationsService, NotificationType } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { PushService } from "../push/push.service";
import { NotificationsGateway } from "./notifications.gateway";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      create: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    libraryItem: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let push: { sendToUser: jest.Mock; sendToUsers: jest.Mock };
  let gateway: { notifyUser: jest.Mock; notifyUsers: jest.Mock };

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      libraryItem: { findMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    push = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
      sendToUsers: jest.fn().mockResolvedValue(undefined),
    };
    gateway = {
      notifyUser: jest.fn(),
      notifyUsers: jest.fn(),
    };

    service = new NotificationsService(
      prisma as unknown as PrismaService,
      push as unknown as PushService,
      gateway as unknown as NotificationsGateway,
    );
  });

  describe("create", () => {
    it("persists the in-app notification, mirrors it as a best-effort push, and emits it over the socket gateway", async () => {
      prisma.notification.create.mockResolvedValue({ id: "notif-1", title: "Hello" });

      const result = await service.create("user-1", NotificationType.WELCOME, "Hello", "body text", {
        foo: "bar",
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: { userId: "user-1", type: NotificationType.WELCOME, title: "Hello", body: "body text", data: { foo: "bar" } },
      });
      expect(push.sendToUser).toHaveBeenCalledWith("user-1", {
        title: "Hello",
        body: "body text",
        url: undefined,
        data: { foo: "bar" },
      });
      expect(gateway.notifyUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual({ id: "notif-1", title: "Hello" });
    });

    it("resolves without waiting on the push side channel (fire-and-forget)", async () => {
      prisma.notification.create.mockResolvedValue({ id: "notif-2" });
      // A push call that never settles must not block `create` from returning —
      // it's called with `void`, not `await`.
      push.sendToUser.mockReturnValue(new Promise<void>(() => {}));

      const result = await service.create("user-1", NotificationType.WELCOME, "Hi");

      expect(result).toEqual({ id: "notif-2" });
      expect(push.sendToUser).toHaveBeenCalled();
    });
  });

  describe("markAsRead / markRead", () => {
    it("throws NotFoundException when the notification doesn't exist", async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markRead("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the notification belongs to someone else", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "notif-1", userId: "someone-else", readAt: null });

      await expect(service.markRead("user-1", "notif-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it("marks an unread notification as read", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "notif-1", userId: "user-1", readAt: null });

      await service.markRead("user-1", "notif-1");

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: { readAt: expect.any(Date) },
      });
    });

    it("is a no-op when the notification is already read", async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: "notif-1",
        userId: "user-1",
        readAt: new Date("2026-01-01"),
      });

      await service.markRead("user-1", "notif-1");

      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe("unread-count", () => {
    it("counts only notifications belonging to the user with readAt: null", async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.unreadCount("user-1");

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: "user-1", readAt: null },
      });
      expect(result).toBe(3);
    });
  });

  describe("notifyNewRelease — fan-out", () => {
    it("fans the notification out to every follower of the artist and mirrors it via push", async () => {
      prisma.libraryItem.findMany.mockResolvedValue([{ userId: "fan-1" }, { userId: "fan-2" }]);
      prisma.notification.createMany.mockResolvedValue({ count: 2 });

      await service.notifyNewRelease("artist-1", "Artist One", "song-1", "New Song");

      expect(prisma.libraryItem.findMany).toHaveBeenCalledWith({
        where: { itemType: "ARTIST", artistId: "artist-1" },
        select: { userId: true },
      });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: "fan-1",
            type: NotificationType.NEW_RELEASE,
            title: "New release from Artist One",
            body: "New Song",
            data: { artistId: "artist-1", songId: "song-1" },
          },
          {
            userId: "fan-2",
            type: NotificationType.NEW_RELEASE,
            title: "New release from Artist One",
            body: "New Song",
            data: { artistId: "artist-1", songId: "song-1" },
          },
        ],
      });
      expect(push.sendToUsers).toHaveBeenCalledWith(["fan-1", "fan-2"], {
        title: "New release from Artist One",
        body: "New Song",
        url: "/song/song-1",
        data: { artistId: "artist-1", songId: "song-1" },
      });
      expect(gateway.notifyUsers).toHaveBeenCalledWith(["fan-1", "fan-2"]);
    });

    it("skips createMany, push, and the socket fan-out entirely when the artist has no followers", async () => {
      prisma.libraryItem.findMany.mockResolvedValue([]);

      await service.notifyNewRelease("artist-1", "Artist One", "song-1", "New Song");

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(push.sendToUsers).not.toHaveBeenCalled();
      expect(gateway.notifyUsers).not.toHaveBeenCalled();
    });

    it("never throws — a fan-out failure must not roll back the song creation that triggered it", async () => {
      prisma.libraryItem.findMany.mockRejectedValue(new Error("db down"));

      await expect(
        service.notifyNewRelease("artist-1", "Artist One", "song-1", "New Song"),
      ).resolves.toBeUndefined();
    });
  });

  describe("findMine", () => {
    it("returns a paginated list scoped to the caller", async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: "notif-1" }]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.findMine("user-1", { page: 1, limit: 20, skip: 0 } as never);

      expect(result).toEqual({ items: [{ id: "notif-1" }], page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  describe("markAllRead", () => {
    it("marks every unread notification for the user as read in one call", async () => {
      await service.markAllRead("user-1");

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
