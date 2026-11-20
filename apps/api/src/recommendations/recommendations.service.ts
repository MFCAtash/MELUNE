import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";
import { cosineSimilarity, weightedAverage } from "../common/utils/vector-math";

/**
 * Phase 8.2 — content-based "For You" recommendations.
 *
 * Per docs/ai.md this is the lightweight step *before* collaborative
 * filtering / a separate Python service (reserved for Phase 9, once
 * user/interaction volume actually justifies the operational cost of a
 * second runtime). Everything here runs inside the existing Nest/Postgres
 * stack:
 *
 *   1. Build a taste *profile* vector for the user from the songs they
 *      liked/played — features are genre (one-hot), artist (one-hot,
 *      capped to their top artists), mood (one-hot) and bpm/energy
 *      (normalized numeric), i.e. exactly "genre + artist + BPM/mood"
 *      metadata, nothing else.
 *   2. Pull a bounded candidate set from Postgres (same genre/artist as
 *      the profile, excluding what they've already heard).
 *   3. Rank candidates by cosine similarity to the profile vector.
 *
 * This is intentionally *not* a raw-SQL cosine query — Postgres has no
 * built-in vector type without the `pgvector` extension, and the
 * candidate sets here (a few hundred rows) are small enough that doing
 * the arithmetic in Node after one bounded query is simpler and just as
 * fast as maintaining a second extension for this stage.
 */

const SONG_INCLUDE = {
  artist: { select: { id: true, name: true, slug: true } },
  album: { select: { id: true, title: true, slug: true, coverUrl: true } },
  genre: { select: { id: true, name: true, slug: true } },
} as const;

interface SongFeatureRow {
  id: string;
  artistId: string;
  genreId: string | null;
  mood: string | null;
  bpm: number | null;
  energy: number | null;
}

interface Interaction {
  song: SongFeatureRow;
  weight: number;
}

interface FeatureSpace {
  genreIndex: Map<string, number>;
  artistIndex: Map<string, number>;
  moodIndex: Map<string, number>;
  dims: number; // total vector length
}

export interface ScoredSong {
  songId: string;
  score: number;
}

export interface ForYouResult {
  scored: ScoredSong[];
  basis: "profile" | "none";
}

// Feature weights — artist affinity is the strongest single taste signal
// (people follow artists more consistently than genres), genre next,
// mood/bpm are a lighter tie-breaker since they're sparsely populated.
const WEIGHT = { genre: 1.0, artist: 1.5, mood: 0.8, numeric: 0.6 };

const LIKE_WEIGHT = 2.0;
// Exponential recency decay for listening history: the most recently
// played song has weight 1, each one further back a bit less — so a
// binge from a year ago doesn't outweigh what the user is into today.
const HISTORY_DECAY = 0.97;

const MAX_LIKES = 150;
const MAX_HISTORY = 150;
const MAX_ARTIST_DIMS = 40; // bounds vector size when someone has eclectic taste
const MAX_MOOD_DIMS = 20;
const CANDIDATE_LIMIT = 400;
const BPM_NORMALIZATION = 200; // typical song tempo ceiling for min-max scaling

const CACHE_PREFIX = "recs:foryou:";
const CACHE_TTL_SECONDS = 300;

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Top `limit` songs for the user's "For You" mix, or `basis: "none"`
   *  when they don't have enough history/likes yet to build a profile —
   *  callers must never backfill that case with unrelated songs. */
  async getForYou(userId: string, limit: number): Promise<ForYouResult> {
    const cacheKey = `${CACHE_PREFIX}${userId}:${limit}`;
    return this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS, () => this.compute(userId, limit));
  }

  private async compute(userId: string, limit: number): Promise<ForYouResult> {
    const interactions = await this.loadInteractions(userId);
    if (interactions.length === 0) {
      return { scored: [], basis: "none" };
    }

    const space = this.buildFeatureSpace(interactions.map((i) => i.song));
    const profile = weightedAverage(
      interactions.map((i) => this.vectorize(i.song, space)),
      interactions.map((i) => i.weight),
    );

    const interactedIds = new Set(interactions.map((i) => i.song.id));
    const profileGenreIds = [...space.genreIndex.keys()];
    const profileArtistIds = [...space.artistIndex.keys()];

    const candidates = await this.loadCandidates(
      interactedIds,
      profileGenreIds,
      profileArtistIds,
    );

    const scored = candidates
      .map((c) => ({ songId: c.id, score: cosineSimilarity(profile, this.vectorize(c, space)) }))
      // A score of 0 means the candidate shares literally no feature
      // dimension with anything the user has engaged with — not a
      // recommendation, just noise from the broadened fallback query.
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { scored, basis: "profile" };
  }

  /** Hydrates the ranked song IDs back into full Song records, in ranked order. */
  async hydrate(scored: ScoredSong[]) {
    if (scored.length === 0) return [];
    const songs = await this.prisma.song.findMany({
      where: { id: { in: scored.map((s) => s.songId) } },
      include: SONG_INCLUDE,
    });
    const byId = new Map(songs.map((s) => [s.id, s]));
    return scored.map((s) => byId.get(s.songId)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  }

  // ---------------------------------------------------------------- data

  private async loadInteractions(userId: string): Promise<Interaction[]> {
    const [likes, history] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, song: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        take: MAX_LIKES,
        select: {
          song: { select: { id: true, artistId: true, genreId: true, mood: true, bpm: true, energy: true } },
        },
      }),
      this.prisma.listeningHistory.findMany({
        where: { userId, song: { deletedAt: null } },
        orderBy: { playedAt: "desc" },
        take: MAX_HISTORY,
        select: {
          song: { select: { id: true, artistId: true, genreId: true, mood: true, bpm: true, energy: true } },
        },
      }),
    ]);

    // A song can appear in both likes and history — combine into one
    // interaction per song, taking the stronger of the two weights
    // rather than double-counting it in the profile average.
    const byId = new Map<string, Interaction>();

    likes.forEach(({ song }) => {
      byId.set(song.id, { song, weight: LIKE_WEIGHT });
    });

    history.forEach(({ song }, index) => {
      const decayed = Math.pow(HISTORY_DECAY, index);
      const existing = byId.get(song.id);
      byId.set(song.id, { song, weight: Math.max(existing?.weight ?? 0, decayed) });
    });

    return [...byId.values()];
  }

  private async loadCandidates(
    excludeIds: Set<string>,
    genreIds: string[],
    artistIds: string[],
  ) {
    const baseWhere = { deletedAt: null, id: { notIn: [...excludeIds] } };

    // Primary pass: content-filtered to the user's known genres/artists —
    // this is what keeps the candidate set (and therefore the cosine
    // computation) small even on a large catalog.
    const primary = await this.prisma.song.findMany({
      where: {
        ...baseWhere,
        OR: [
          ...(genreIds.length ? [{ genreId: { in: genreIds } }] : []),
          ...(artistIds.length ? [{ artistId: { in: artistIds } }] : []),
        ],
      },
      orderBy: { playCount: "desc" },
      take: CANDIDATE_LIMIT,
      select: { id: true, artistId: true, genreId: true, mood: true, bpm: true, energy: true },
    });

    if (primary.length >= CANDIDATE_LIMIT) return primary;

    // Fallback pass: top the set up with generally popular songs so a
    // user with very narrow history still gets a full page of results,
    // instead of three matches and nothing else.
    const seen = new Set(primary.map((s) => s.id));
    const fallback = await this.prisma.song.findMany({
      where: baseWhere,
      orderBy: { playCount: "desc" },
      take: CANDIDATE_LIMIT - primary.length,
      select: { id: true, artistId: true, genreId: true, mood: true, bpm: true, energy: true },
    });

    return [...primary, ...fallback.filter((s) => !seen.has(s.id))];
  }

  // ------------------------------------------------------------ vectors

  private buildFeatureSpace(songs: SongFeatureRow[]): FeatureSpace {
    const genreCounts = new Map<string, number>();
    const artistCounts = new Map<string, number>();
    const moodCounts = new Map<string, number>();

    for (const s of songs) {
      if (s.genreId) genreCounts.set(s.genreId, (genreCounts.get(s.genreId) ?? 0) + 1);
      artistCounts.set(s.artistId, (artistCounts.get(s.artistId) ?? 0) + 1);
      if (s.mood) moodCounts.set(s.mood, (moodCounts.get(s.mood) ?? 0) + 1);
    }

    const genreIndex = new Map([...genreCounts.keys()].map((id, i) => [id, i]));
    const artistIndex = new Map(
      topKeysByCount(artistCounts, MAX_ARTIST_DIMS).map((id, i) => [id, i]),
    );
    const moodIndex = new Map(topKeysByCount(moodCounts, MAX_MOOD_DIMS).map((id, i) => [id, i]));

    // + 2 numeric dims: normalized bpm, normalized energy.
    const dims = genreIndex.size + artistIndex.size + moodIndex.size + 2;
    return { genreIndex, artistIndex, moodIndex, dims };
  }

  private vectorize(song: SongFeatureRow, space: FeatureSpace): number[] {
    const v = new Array<number>(space.dims).fill(0);

    if (song.genreId && space.genreIndex.has(song.genreId)) {
      v[space.genreIndex.get(song.genreId)!] = WEIGHT.genre;
    }

    const artistOffset = space.genreIndex.size;
    if (space.artistIndex.has(song.artistId)) {
      v[artistOffset + space.artistIndex.get(song.artistId)!] = WEIGHT.artist;
    }

    const moodOffset = artistOffset + space.artistIndex.size;
    if (song.mood && space.moodIndex.has(song.mood)) {
      v[moodOffset + space.moodIndex.get(song.mood)!] = WEIGHT.mood;
    }

    const numericOffset = moodOffset + space.moodIndex.size;
    // Missing bpm/energy fall back to a neutral 0 contribution on that
    // single dimension rather than guessing a value — with a weight of
    // 0.6 out of a vector otherwise dominated by genre/artist, an
    // unset tempo/energy never meaningfully skews the ranking.
    v[numericOffset] = song.bpm ? clamp01(song.bpm / BPM_NORMALIZATION) * WEIGHT.numeric : 0;
    v[numericOffset + 1] = song.energy != null ? clamp01(song.energy) * WEIGHT.numeric : 0;

    return v;
  }
}

function topKeysByCount(counts: Map<string, number>, max: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([key]) => key);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
