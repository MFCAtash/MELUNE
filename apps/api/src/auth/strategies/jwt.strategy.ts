import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../redis/cache.service";
import { AuthenticatedUser } from "../types/authenticated-user";

interface AccessTokenPayload {
  sub: string;
}

interface CachedUserStatus {
  banned: boolean;
  email: string;
  username: string;
  role: AuthenticatedUser["role"];
}

// Short TTL cache so this doesn't hit Postgres on every single
// authenticated request. Banning is invalidated eagerly (see
// AdminService.banUser/unbanUser, which delete this same key), so the
// TTL only bounds the *worst case* — a banned user staying authorized
// for at most this long if the invalidation itself were ever missed —
// not the normal-case propagation delay, which is immediate.
const USER_STATUS_CACHE_TTL_SECONDS = 45;

export function userStatusCacheKey(userId: string): string {
  return `auth:user-status:${userId}`;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const cacheKey = userStatusCacheKey(payload.sub);
    let status = await this.cache.get<CachedUserStatus>(cacheKey);

    if (!status) {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException("User no longer exists");
      }

      status = {
        banned: Boolean(user.deletedAt),
        email: user.email,
        username: user.username,
        role: user.role,
      };
      await this.cache.set(cacheKey, status, USER_STATUS_CACHE_TTL_SECONDS);
    }

    if (status.banned) {
      throw new UnauthorizedException("User no longer exists");
    }

    return {
      id: payload.sub,
      email: status.email,
      username: status.username,
      role: status.role,
    };
  }
}
