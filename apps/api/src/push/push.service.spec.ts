import { ConfigService } from "@nestjs/config";

const setVapidDetailsMock = jest.fn();
const sendNotificationMock = jest.fn();

jest.mock("web-push", () => ({
  setVapidDetails: (...args: unknown[]) => setVapidDetailsMock(...args),
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
}));

import { PushService } from "./push.service";
import { PrismaService } from "../prisma/prisma.service";

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "mailto:support@codexmusic.app",
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe("PushService", () => {
  let prisma: {
    pushSubscription: {
      findMany: jest.Mock;
      delete: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    setVapidDetailsMock.mockReset();
    sendNotificationMock.mockReset();
    prisma = {
      pushSubscription: {
        findMany: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
  });

  describe("sendToUser — VAPID not configured", () => {
    it("is a no-op and never touches Prisma or web-push when keys are missing", async () => {
      const service = new PushService(
        makeConfig({ VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined }),
        prisma as unknown as PrismaService,
      );

      expect(service.configured).toBe(false);
      expect(setVapidDetailsMock).not.toHaveBeenCalled();

      await service.sendToUser("user-1", { title: "Hello" });

      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
      expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it("is also a no-op when only one of the two VAPID keys is set", async () => {
      const service = new PushService(
        makeConfig({ VAPID_PRIVATE_KEY: undefined }),
        prisma as unknown as PrismaService,
      );

      expect(service.configured).toBe(false);

      await service.sendToUser("user-1", { title: "Hello" });

      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe("sendToUser — VAPID configured", () => {
    it("sets the VAPID details once, at construction", () => {
      new PushService(makeConfig(), prisma as unknown as PrismaService);

      expect(setVapidDetailsMock).toHaveBeenCalledWith(
        "mailto:support@codexmusic.app",
        "public-key",
        "private-key",
      );
    });

    it("does nothing when the user has no subscriptions", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);
      prisma.pushSubscription.findMany.mockResolvedValue([]);

      await service.sendToUser("user-1", { title: "Hello" });

      expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it("sends the payload to every subscription the user has", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
        { id: "sub-2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
      ]);
      sendNotificationMock.mockResolvedValue(undefined);

      await service.sendToUser("user-1", { title: "New release", url: "/song/1" });

      expect(sendNotificationMock).toHaveBeenCalledTimes(2);
      expect(sendNotificationMock).toHaveBeenCalledWith(
        { endpoint: "https://push.example/1", keys: { p256dh: "p1", auth: "a1" } },
        JSON.stringify({ title: "New release", url: "/song/1" }),
      );
    });

    it("deletes the subscription row on a 404 from the browser's push service", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      ]);
      sendNotificationMock.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 404 }));

      await service.sendToUser("user-1", { title: "Hello" });

      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: "sub-1" } });
    });

    it("deletes the subscription row on a 410 from the browser's push service", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      ]);
      sendNotificationMock.mockRejectedValue(Object.assign(new Error("Expired"), { statusCode: 410 }));

      await service.sendToUser("user-1", { title: "Hello" });

      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: "sub-1" } });
    });

    it("keeps the subscription and just logs on any other failure (e.g. a transient 500)", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      ]);
      sendNotificationMock.mockRejectedValue(Object.assign(new Error("Server error"), { statusCode: 500 }));

      await expect(service.sendToUser("user-1", { title: "Hello" })).resolves.toBeUndefined();

      expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
    });

    it("never throws even when the initial findMany lookup fails", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);
      prisma.pushSubscription.findMany.mockRejectedValue(new Error("db down"));

      await expect(service.sendToUser("user-1", { title: "Hello" })).resolves.toBeUndefined();
    });
  });

  describe("sendToUsers — fan-out", () => {
    it("is a no-op when VAPID isn't configured, even with a non-empty user list", async () => {
      const service = new PushService(
        makeConfig({ VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined }),
        prisma as unknown as PrismaService,
      );

      await service.sendToUsers(["user-1", "user-2"], { title: "Hello" });

      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    });

    it("is a no-op for an empty user list", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);

      await service.sendToUsers([], { title: "Hello" });

      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    });

    it("sends the same payload to every user in the list", async () => {
      const service = new PushService(makeConfig(), prisma as unknown as PrismaService);
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      ]);

      await service.sendToUsers(["user-1", "user-2"], { title: "Hello" });

      expect(prisma.pushSubscription.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: "user-2" } });
    });
  });
});
