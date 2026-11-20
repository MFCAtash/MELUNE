import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { v4 as uuid } from "uuid";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CacheService } from "../redis/cache.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { AuthenticatedUser } from "./types/authenticated-user";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Temporary account lockout: independent of the per-IP throttle on the
// controller, this is keyed by account (email) so a distributed attacker
// spreading requests across many IPs still gets locked out of one
// specific account after enough bad passwords. Counters live in Redis,
// never the DB — this is a fast-moving, self-expiring signal, not
// something worth a migration or a row per attempt.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes

function loginFailKey(email: string): string {
  return `auth:login-fails:${email.toLowerCase()}`;
}

function loginLockKey(email: string): string {
  return `auth:login-lock:${email.toLowerCase()}`;
}

function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException("Email or username is already taken");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        password: passwordHash,
      },
    });

    await this.issueEmailVerification(user.id, user.email);
    await this.notifications.welcome(user.id, user.username);

    const tokens = await this.issueTokens(user.id);
    return { user: this.toAuthenticatedUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const locked = await this.cache.get<boolean>(loginLockKey(dto.email));
    if (locked) {
      throw new UnauthorizedException(
        "Too many failed login attempts. Try again in a few minutes.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.deletedAt) {
      await this.registerFailedLogin(dto.email);
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      await this.registerFailedLogin(dto.email);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Successful login clears any strikes so a genuine owner who mistyped
    // their password a couple of times isn't left one attempt away from
    // a lockout next time.
    await this.cache.del(loginFailKey(dto.email), loginLockKey(dto.email));

    const tokens = await this.issueTokens(user.id);
    return { user: this.toAuthenticatedUser(user), tokens };
  }

  /** Rotates the refresh token: the presented one is revoked and a new one issued. */
  async refresh(rawRefreshToken: string): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now() ||
      stored.user.deletedAt
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.userId);
    return { user: this.toAuthenticatedUser(stored.user), tokens };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always resolve silently — confirming/denying account existence here
    // would let an attacker enumerate registered emails.
    if (!user) return;

    const rawToken = uuid();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await this.mail.sendPasswordResetEmail(user.email, rawToken);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.usedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { password: passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // Resetting the password invalidates every existing session.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const stored = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Invalid or expired verification token");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  // ---- internal helpers ----

  /** Bumps the failed-attempt counter for this email and, once it crosses
   *  the threshold, sets a short-lived lockout flag — both self-expiring
   *  in Redis, so a locked account opens back up on its own. */
  private async registerFailedLogin(email: string): Promise<void> {
    const attempts = await this.cache.increment(loginFailKey(email), LOGIN_LOCKOUT_TTL_SECONDS);
    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.cache.set(loginLockKey(email), true, LOGIN_LOCKOUT_TTL_SECONDS);
    }
  }

  private async issueEmailVerification(userId: string, email: string): Promise<void> {
    const rawToken = uuid();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });
    await this.mail.sendVerificationEmail(email, rawToken);
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
      },
    );

    const rawRefreshToken = uuid();
    const refreshTtl = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d");
    const expiresAt = new Date(Date.now() + parseTtlMs(refreshTtl));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(rawRefreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    username: string;
    role: AuthenticatedUser["role"];
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
  }
}

/** Parses simple durations like "15m", "7d", "1h" into milliseconds. */
function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days

  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return value * unitMs;
}
