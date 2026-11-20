import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";
import { Paginated } from "../common/dto/pagination-query.dto";
import { userStatusCacheKey } from "../auth/strategies/jwt.strategy";
import { AdminUserQueryDto } from "./dto/admin-user-query.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  avatarUrl: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  artistProfile: { select: { id: true } },
} as const;

const SONG_INCLUDE = {
  artist: { select: { id: true, name: true, slug: true } },
  album: { select: { id: true, title: true, slug: true, coverUrl: true } },
  genre: { select: { id: true, name: true, slug: true } },
} as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface DailyCountRow {
  day: Date;
  count: bigint;
}

function toAdminUser<T extends { artistProfile: { id: string } | null }>(user: T) {
  const { artistProfile, ...rest } = user;
  return { ...rest, isArtist: Boolean(artistProfile) };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ---------------------------------------------------------- dashboard

  async getStats() {
    const since = new Date(Date.now() - SEVEN_DAYS_MS);

    const [
      users,
      artists,
      songs,
      albums,
      playlists,
      newUsersLast7Days,
      playsLast7Days,
      topSongs,
      usersByDay,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.artist.count({ where: { deletedAt: null } }),
      this.prisma.song.count({ where: { deletedAt: null } }),
      this.prisma.album.count({ where: { deletedAt: null } }),
      this.prisma.playlist.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: since } } }),
      this.prisma.listeningHistory.count({ where: { playedAt: { gte: since } } }),
      this.prisma.song.findMany({
        where: { deletedAt: null },
        orderBy: { playCount: "desc" },
        take: 5,
        include: SONG_INCLUDE,
      }),
      // date_trunc groups by calendar day in UTC — Prisma's query builder
      // has no generic date-bucketing helper, same rationale as the
      // to_tsvector raw queries in SearchService.
      this.prisma.$queryRaw<DailyCountRow[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "users"
        WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    return {
      totals: { users, artists, songs, albums, playlists },
      newUsersLast7Days,
      playsLast7Days,
      topSongs,
      usersByDay: usersByDay.map((row) => ({
        date: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
      })),
    };
  }

  // -------------------------------------------------------------- users

  async listUsers(query: AdminUserQueryDto): Promise<Paginated<unknown>> {
    const where = {
      ...(query.includeBanned === "true" ? {} : { deletedAt: null }),
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: "insensitive" as const } },
              { username: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        select: ADMIN_USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map(toAdminUser),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async updateRole(requestingAdminId: string, targetUserId: string, dto: UpdateUserRoleDto) {
    if (requestingAdminId === targetUserId && dto.role !== "ADMIN") {
      // Guardrail: an admin can't lock themselves out by demoting their
      // own account — they'd need another admin to do it for them.
      throw new BadRequestException("You cannot change your own admin role");
    }

    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
      select: ADMIN_USER_SELECT,
    });

    // The cached auth status carries `role` too — without this, a demoted
    // admin (or promoted user) would keep acting under the old role for
    // up to USER_STATUS_CACHE_TTL_SECONDS.
    await this.cache.del(userStatusCacheKey(targetUserId));

    return toAdminUser(updated);
  }

  /** Soft-bans the account and revokes every active session — a ban that
   *  left existing access/refresh tokens valid wouldn't actually stop them.
   *  Also evicts the cached auth status immediately, so the ban takes
   *  effect on the account's very next request rather than waiting out
   *  the cache TTL. */
  async banUser(requestingAdminId: string, targetUserId: string) {
    if (requestingAdminId === targetUserId) {
      throw new BadRequestException("You cannot ban your own account");
    }

    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { deletedAt: new Date() },
        select: ADMIN_USER_SELECT,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.cache.del(userStatusCacheKey(targetUserId));

    return toAdminUser(updated);
  }

  async unbanUser(targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { deletedAt: null },
      select: ADMIN_USER_SELECT,
    });

    await this.cache.del(userStatusCacheKey(targetUserId));

    return toAdminUser(updated);
  }
}
