import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CacheService } from "../redis/cache.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    refreshToken: { create: jest.Mock };
    emailVerificationToken: { create: jest.Mock };
  };
  let mail: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };
  let notifications: { welcome: jest.Mock };
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    increment: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
      emailVerificationToken: { create: jest.fn().mockResolvedValue({}) },
    };

    mail = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    notifications = {
      welcome: jest.fn().mockResolvedValue(undefined),
    };

    // No lockout in effect and every increment stays under the
    // threshold by default — individual tests override this when they
    // need to exercise the lockout path itself.
    cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(1),
    };

    const jwt = new JwtService({ secret: "test-secret" });
    const config = new ConfigService({
      JWT_ACCESS_SECRET: "test-secret",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "7d",
    });

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      config,
      mail as unknown as MailService,
      notifications as unknown as NotificationsService,
      cache as unknown as CacheService,
    );
  });

  describe("register", () => {
    it("throws ConflictException when email or username is taken", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "existing-user" });

      await expect(
        service.register({
          email: "taken@example.com",
          username: "taken",
          password: "supersecret",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("hashes the password and issues tokens on success", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "new@example.com",
        username: "newuser",
        password: "hashed",
        role: "USER",
      });

      const result = await service.register({
        email: "new@example.com",
        username: "newuser",
        password: "supersecret",
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.password).not.toBe("supersecret");
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
        "new@example.com",
        expect.any(String),
      );
    });
  });

  describe("login", () => {
    it("throws UnauthorizedException for unknown email", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "ghost@example.com", password: "whatever" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws UnauthorizedException for wrong password", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        username: "user1",
        password: passwordHash,
        role: "USER",
        deletedAt: null,
      });

      await expect(
        service.login({ email: "user@example.com", password: "wrong-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("issues tokens for correct credentials", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        username: "user1",
        password: passwordHash,
        role: "USER",
        deletedAt: null,
      });

      const result = await service.login({
        email: "user@example.com",
        password: "correct-password",
      });

      expect(result.user.id).toBe("user-1");
      expect(result.tokens.accessToken).toEqual(expect.any(String));
    });

    it("rejects immediately, without touching the DB, once the account is locked out", async () => {
      cache.get.mockResolvedValue(true); // lockout flag set

      await expect(
        service.login({ email: "user@example.com", password: "whatever" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("sets the lockout flag once failed attempts cross the threshold", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        username: "user1",
        password: passwordHash,
        role: "USER",
        deletedAt: null,
      });
      cache.increment.mockResolvedValue(5); // at the threshold

      await expect(
        service.login({ email: "user@example.com", password: "wrong-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining("auth:login-lock:"),
        true,
        expect.any(Number),
      );
    });

    it("clears any failed-attempt strikes on a successful login", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        username: "user1",
        password: passwordHash,
        role: "USER",
        deletedAt: null,
      });

      await service.login({ email: "user@example.com", password: "correct-password" });

      expect(cache.del).toHaveBeenCalledWith(
        expect.stringContaining("auth:login-fails:"),
        expect.stringContaining("auth:login-lock:"),
      );
    });
  });
});
