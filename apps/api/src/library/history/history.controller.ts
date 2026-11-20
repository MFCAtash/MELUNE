import { Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { HistoryService } from "./history.service";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";

class RecentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

@Controller("me/history")
export class HistoryController {
  constructor(
    private readonly history: HistoryService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(":songId")
  @HttpCode(204)
  recordPlay(@Param("songId") songId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.history.recordPlay(user.id, songId);
  }

  @Get()
  async findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: RecentQueryDto) {
    const recent = await this.history.recentSongIds(user.id, query.limit);
    if (recent.length === 0) return [];

    const songs = await this.prisma.song.findMany({
      where: { id: { in: recent.map((r) => r.songId) } },
      include: {
        artist: { select: { id: true, name: true, slug: true } },
        album: { select: { id: true, title: true, slug: true, coverUrl: true } },
        genre: { select: { id: true, name: true, slug: true } },
      },
    });
    const byId = new Map(songs.map((s) => [s.id, s]));

    // Re-apply recency order — the `findMany` above doesn't preserve it.
    return recent
      .map((r) => byId.get(r.songId))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }
}
