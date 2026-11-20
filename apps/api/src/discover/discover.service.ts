import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HistoryService } from "../library/history/history.service";
import { CacheService } from "../redis/cache.service";
import { HybridRecommendationsService } from "../recommendations/hybrid-recommendations.service";

const TRENDING_CACHE_KEY = "discover:trending";
const TRENDING_TTL_SECONDS = 120;

const SONG_INCLUDE = {
  artist: { select: { id: true, name: true, slug: true } },
  album: { select: { id: true, title: true, slug: true, coverUrl: true } },
  genre: { select: { id: true, name: true, slug: true } },
} as const;

export interface HomeFeed {
  recentlyPlayed: unknown[];
  trending: unknown[];
  /** null when the user has no listening history yet to base a mix on —
   *  shown as "not enough data yet" in the UI, never backfilled with
   *  unrelated songs pretending to be personalized. */
  madeForYou: unknown[] | null;
}

@Injectable()
export class DiscoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly cache: CacheService,
    private readonly recommendations: HybridRecommendationsService,
  ) {}

  /** userId is undefined for anonymous visitors — they get Trending only. */
  async getHome(userId: string | undefined): Promise<HomeFeed> {
    // Trending is identical for every visitor (not personalized), and this
    // is the single most-hit endpoint on the site (home page + logged-out
    // landing page), so it's the highest-value Redis cache target here.
    const trending = await this.cache.getOrSet(TRENDING_CACHE_KEY, TRENDING_TTL_SECONDS, () =>
      this.prisma.song.findMany({
        where: { deletedAt: null },
        orderBy: { playCount: "desc" },
        take: 20,
        include: SONG_INCLUDE,
      }),
    );

    if (!userId) {
      return { recentlyPlayed: [], trending, madeForYou: null };
    }

    const recent = await this.history.recentSongIds(userId, 20);
    const recentSongs = recent.length
      ? await this.hydrateOrdered(recent.map((r) => r.songId))
      : [];

    // Phase 9 — hybrid mix of the content-based cosine-similarity engine
    // (RecommendationsService) and item-item collaborative filtering
    // (CollaborativeService), combined by HybridRecommendationsService.
    // `basis` is "hybrid" once both signals are available, "profile" when
    // it fell back to content-based alone (not enough collaborative data
    // yet), or "none" — which, same contract as before, is never silently
    // padded with a generic list.
    const { scored, basis } = await this.recommendations.getForYou(userId, 20);
    const madeForYou = basis !== "none" ? await this.recommendations.hydrate(scored) : null;

    return { recentlyPlayed: recentSongs, trending, madeForYou };
  }

  private async hydrateOrdered(songIds: string[]) {
    const songs = await this.prisma.song.findMany({
      where: { id: { in: songIds } },
      include: SONG_INCLUDE,
    });
    const byId = new Map(songs.map((s) => [s.id, s]));
    return songIds.map((id) => byId.get(id)).filter(Boolean);
  }
}
