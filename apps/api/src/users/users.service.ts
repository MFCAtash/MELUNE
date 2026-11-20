import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";
import { UpdateUserDto } from "./dto/update-user.dto";

const STATS_TTL_SECONDS = 300;

export interface UserStats {
  likes: number;
  playlists: number;
  plays: number;
}

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  avatarUrl: true,
  bio: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: PUBLIC_USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateMe(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: PUBLIC_USER_SELECT,
    });
  }

  /**
   * Counts for the profile/library stats panel. Same tradeoff as Discover's
   * trending cache: a short TTL instead of invalidating on every like/
   * playlist/play, so a stat can lag its own action by up to 5 minutes.
   * Cheap enough here (three cheap counts, one low-traffic panel) that this
   * is the right side of that tradeoff rather than wiring up invalidation
   * across the likes/playlists/history services.
   */
  async getStats(userId: string): Promise<UserStats> {
    return this.cache.getOrSet(`user:${userId}:stats`, STATS_TTL_SECONDS, async () => {
      const [likes, playlists, plays] = await Promise.all([
        this.prisma.like.count({ where: { userId } }),
        this.prisma.playlist.count({ where: { ownerId: userId, deletedAt: null } }),
        this.prisma.listeningHistory.count({ where: { userId } }),
      ]);
      return { likes, playlists, plays };
    });
  }
}
