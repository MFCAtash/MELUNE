import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface RecentPlay {
  songId: string;
  lastPlayedAt: Date;
}

export interface GenreAffinity {
  genreId: string;
  plays: number;
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records one play and bumps the song's global playCount in the same
   * transaction, so "Trending" (sorted by playCount) and "Recently played"
   * (read from history rows) can never drift apart.
   */
  async recordPlay(userId: string, songId: string): Promise<void> {
    const song = await this.prisma.song.findUnique({ where: { id: songId } });
    if (!song || song.deletedAt) throw new NotFoundException("Song not found");

    await this.prisma.$transaction([
      this.prisma.listeningHistory.create({ data: { userId, songId } }),
      this.prisma.song.update({
        where: { id: songId },
        data: { playCount: { increment: 1 } },
      }),
    ]);
  }

  /** Most-recently-played songs, deduped by song (latest play wins). */
  async recentSongIds(userId: string, limit: number): Promise<RecentPlay[]> {
    // Pull more raw rows than `limit` distinct songs, then dedupe in
    // application code — Prisma has no `DISTINCT ON` helper, and a raw
    // SQL DISTINCT ON here would bypass the soft-delete/typed layer for
    // a query this small.
    const rows = await this.prisma.listeningHistory.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: limit * 5,
      select: { songId: true, playedAt: true },
    });

    const seen = new Set<string>();
    const result: RecentPlay[] = [];
    for (const row of rows) {
      if (seen.has(row.songId)) continue;
      seen.add(row.songId);
      result.push({ songId: row.songId, lastPlayedAt: row.playedAt });
      if (result.length >= limit) break;
    }
    return result;
  }

  /** The user's most-played genres, used for the "Made for you" mix. */
  async topGenres(userId: string, limit: number): Promise<GenreAffinity[]> {
    const rows = await this.prisma.listeningHistory.findMany({
      where: { userId },
      select: { song: { select: { genreId: true } } },
      take: 500,
      orderBy: { playedAt: "desc" },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      const genreId = row.song.genreId;
      if (!genreId) continue;
      counts.set(genreId, (counts.get(genreId) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([genreId, plays]) => ({ genreId, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, limit);
  }
}
