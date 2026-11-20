import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Paginated } from "../common/dto/pagination-query.dto";
import { CacheService } from "../redis/cache.service";

const SONG_INCLUDE = {
  artist: { select: { id: true, name: true, slug: true, imageUrl: true } },
  album: { select: { id: true, title: true, slug: true, coverUrl: true } },
  genre: { select: { id: true, name: true, slug: true } },
} as const;

const ARTIST_SELECT = { id: true, name: true, slug: true, bio: true, imageUrl: true } as const;

const ALBUM_INCLUDE = {
  artist: { select: { id: true, name: true, slug: true, imageUrl: true } },
} as const;

const PLAYLIST_INCLUDE = {
  owner: { select: { id: true, username: true, avatarUrl: true } },
} as const;

/** How many results each group gets in the `type=all` command-palette preview. */
const QUICK_LIMIT = 5;
/** Recent-searches list length, matching the frontend's localStorage cap for guests. */
const HISTORY_LIMIT = 8;
/** Rows kept per user — old ones are pruned on write, not on read. */
const HISTORY_KEEP = 20;

interface RankedRow {
  id: string;
  total: bigint;
}

export interface SearchAll {
  query: string;
  songs: unknown[];
  artists: unknown[];
  albums: unknown[];
  playlists: unknown[];
}

/**
 * Ranks rows by the better of two signals — trigram similarity (typo- and
 * substring-tolerant) and full-text rank (whole-word relevance) — computed
 * at query time with `to_tsvector('simple', col)` rather than a stored
 * generated column, since Prisma's schema DSL can't declare one. The
 * trigram GIN index on each title/name column (see schema.prisma) is what
 * keeps `similarity()`/`%`/`ILIKE` fast at this scale; a plain seq scan
 * would be fine for a demo catalog but wouldn't survive real growth.
 * Popularity (playCount) only breaks ties among equally-relevant matches —
 * it never lets an irrelevant-but-popular song outrank a real match.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Small preview of every type at once — powers the Cmd+K palette. Every
   * keystroke in the palette debounces down to this call, so identical
   * queries within a short window (very common — "a", "al", "alb"... plus
   * many users searching the same trending term) are cheap cache hits
   * instead of four ranked Postgres queries each time. TTL is short since
   * the route is already rate-limited and results should stay fresh.
   */
  async quickSearch(q: string): Promise<SearchAll> {
    const cacheKey = `search:quick:${q.toLowerCase().trim()}`;

    return this.cache.getOrSet(cacheKey, 30, async () => {
      const [songs, artists, albums, playlists] = await Promise.all([
        this.searchSongs(q, 1, QUICK_LIMIT),
        this.searchArtists(q, 1, QUICK_LIMIT),
        this.searchAlbums(q, 1, QUICK_LIMIT),
        this.searchPlaylists(q, 1, QUICK_LIMIT),
      ]);
      return {
        query: q,
        songs: songs.items,
        artists: artists.items,
        albums: albums.items,
        playlists: playlists.items,
      };
    });
  }

  async searchSongs(q: string, page: number, limit: number): Promise<Paginated<unknown>> {
    const skip = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<RankedRow[]>`
      SELECT s.id, count(*) OVER()::bigint AS total
      FROM songs s
      WHERE s."deletedAt" IS NULL
        AND (
          s.title % ${q}
          OR s.title ILIKE '%' || ${q} || '%'
          OR to_tsvector('simple', s.title) @@ plainto_tsquery('simple', ${q})
        )
      ORDER BY GREATEST(
                 similarity(s.title, ${q}),
                 ts_rank(to_tsvector('simple', s.title), plainto_tsquery('simple', ${q}))
               ) DESC,
               s."playCount" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const songs = await this.hydrate(rows, (ids) =>
      this.prisma.song.findMany({ where: { id: { in: ids } }, include: SONG_INCLUDE }),
    );
    return this.paginate(songs, rows, page, limit);
  }

  async searchArtists(q: string, page: number, limit: number): Promise<Paginated<unknown>> {
    const skip = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<RankedRow[]>`
      SELECT a.id, count(*) OVER()::bigint AS total
      FROM artists a
      WHERE a."deletedAt" IS NULL
        AND (
          a.name % ${q}
          OR a.name ILIKE '%' || ${q} || '%'
          OR to_tsvector('simple', a.name) @@ plainto_tsquery('simple', ${q})
        )
      ORDER BY GREATEST(
                 similarity(a.name, ${q}),
                 ts_rank(to_tsvector('simple', a.name), plainto_tsquery('simple', ${q}))
               ) DESC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const artists = await this.hydrate(rows, (ids) =>
      this.prisma.artist.findMany({ where: { id: { in: ids } }, select: ARTIST_SELECT }),
    );
    return this.paginate(artists, rows, page, limit);
  }

  async searchAlbums(q: string, page: number, limit: number): Promise<Paginated<unknown>> {
    const skip = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<RankedRow[]>`
      SELECT al.id, count(*) OVER()::bigint AS total
      FROM albums al
      WHERE al."deletedAt" IS NULL
        AND (
          al.title % ${q}
          OR al.title ILIKE '%' || ${q} || '%'
          OR to_tsvector('simple', al.title) @@ plainto_tsquery('simple', ${q})
        )
      ORDER BY GREATEST(
                 similarity(al.title, ${q}),
                 ts_rank(to_tsvector('simple', al.title), plainto_tsquery('simple', ${q}))
               ) DESC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const albums = await this.hydrate(rows, (ids) =>
      this.prisma.album.findMany({ where: { id: { in: ids } }, include: ALBUM_INCLUDE }),
    );
    return this.paginate(albums, rows, page, limit);
  }

  /** Only public playlists are searchable — private ones stay findable by their owner only, via /library. */
  async searchPlaylists(q: string, page: number, limit: number): Promise<Paginated<unknown>> {
    const skip = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<RankedRow[]>`
      SELECT p.id, count(*) OVER()::bigint AS total
      FROM playlists p
      WHERE p."deletedAt" IS NULL
        AND p."isPublic" = true
        AND (
          p.title % ${q}
          OR p.title ILIKE '%' || ${q} || '%'
          OR to_tsvector('simple', p.title) @@ plainto_tsquery('simple', ${q})
        )
      ORDER BY GREATEST(
                 similarity(p.title, ${q}),
                 ts_rank(to_tsvector('simple', p.title), plainto_tsquery('simple', ${q}))
               ) DESC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const playlists = await this.hydrate(rows, (ids) =>
      this.prisma.playlist.findMany({ where: { id: { in: ids } }, include: PLAYLIST_INCLUDE }),
    );
    return this.paginate(playlists, rows, page, limit);
  }

  // ---- Search history (committed searches only — see schema.prisma) ----

  /**
   * Upsert-by-value: drop any earlier row with the same text, then insert
   * fresh, so re-running an old search bumps it back to the top instead of
   * showing up twice. Trimmed to `HISTORY_KEEP` rows per user on every
   * write, so this never needs a cleanup job.
   */
  async recordHistory(userId: string, query: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.searchHistory.deleteMany({ where: { userId, query } }),
      this.prisma.searchHistory.create({ data: { userId, query } }),
    ]);

    const stale = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: HISTORY_KEEP,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.searchHistory.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }
  }

  async listHistory(userId: string) {
    return this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });
  }

  async clearHistory(userId: string): Promise<void> {
    await this.prisma.searchHistory.deleteMany({ where: { userId } });
  }

  // ---- helpers ----

  /** Re-hydrates ranked ids into full records, preserving the ranked order (Postgres `IN` does not). */
  private async hydrate<T extends { id: string }>(
    rows: RankedRow[],
    load: (ids: string[]) => Promise<T[]>,
  ): Promise<T[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const records = await load(ids);
    const byId = new Map(records.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is T => Boolean(r));
  }

  private paginate<T>(items: T[], rows: RankedRow[], page: number, limit: number): Paginated<T> {
    const total = Number(rows[0]?.total ?? 0);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) || 0 };
  }
}
