import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";
import { cosineSimilarity } from "../common/utils/vector-math";
import type { ScoredSong } from "./recommendations.service";

/**
 * Phase 9 — item-item collaborative filtering, running *alongside* the
 * content-based engine in `recommendations.service.ts` (which this module
 * never imports from or mutates — see HybridRecommendationsService for how
 * the two outputs are combined).
 *
 * Signal: implicit feedback only (no ratings in this product) — a Like is
 * a much stronger signal than a play, so it's weighted higher:
 *
 *   like = 2, play = 1 (flat — no recency decay; that nuance already lives
 *   in the content-based profile, this engine stays simpler on purpose).
 *
 * Method — "people who (also) liked this" via item-item similarity,
 * *not* matrix factorization:
 *
 *   1. Build the target user's own interaction weights (their "seed" songs).
 *   2. Find neighbor users: other users who interacted with at least one
 *      of those seed songs (bounded — see MAX_NEIGHBORS).
 *   3. Pull those neighbors' *other* interactions as candidate songs.
 *   4. For every (seed, candidate) pair, build each song's vector over the
 *      shared neighbor-user dimension and rank candidates by the
 *      user's-own-seed-weight-weighted cosine similarity to their seeds —
 *      i.e. a candidate scores high when the users who liked/played the
 *      target's favorites also liked/played it.
 *
 * This reuses the exact same `cosineSimilarity` helper as the content-based
 * engine and is bounded the same way (capped row counts, no unbounded
 * cross-joins), so it stays at the same operational cost/complexity level
 * as `RecommendationsService` — appropriate for a single Postgres instance,
 * not a reason to reach for a dedicated ML stack.
 */

interface InteractionRow {
  userId: string;
  songId: string;
  weight: number;
}

export interface CollaborativeResult {
  scored: ScoredSong[];
  /** "none" when there isn't enough *collaborative* signal to trust yet —
   *  either the user has no interactions at all, or too few other users
   *  overlap with their taste (new catalog, brand-new user, very niche
   *  taste). Callers (HybridRecommendationsService) must fall back to the
   *  content-based engine in that case, never pad with generic songs. */
  basis: "collaborative" | "none";
}

const LIKE_WEIGHT = 2;
const PLAY_WEIGHT = 1;

// Bounds — every query here is capped so this stays a handful of small,
// indexed lookups per request even on a large catalog/user base.
const MAX_SEED_LIKES = 150;
const MAX_SEED_HISTORY = 150;
const MAX_NEIGHBOR_OVERLAP_ROWS = 3000; // rows scanned to *discover* neighbors
const MAX_NEIGHBORS = 200; // neighbors actually kept, ranked by overlap strength
const MAX_NEIGHBOR_INTERACTION_ROWS = 5000; // rows scanned to learn neighbors' *other* taste
const MAX_SEED_ITEMS_FOR_SIMILARITY = 60; // top-weighted seeds used in the similarity pass
const CANDIDATE_LIMIT = 300;

// Below this many neighbors, "similar users" is too small a sample to be
// meaningful — a handful of overlapping plays can otherwise produce a
// wildly overconfident-looking score for a couple of random songs.
const MIN_NEIGHBORS = 3;

const CACHE_PREFIX = "recs:collab:";
const CACHE_TTL_SECONDS = 300;

@Injectable()
export class CollaborativeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Top `limit` songs ranked by item-item collaborative similarity, or
   *  `basis: "none"` when the user/catalog doesn't have enough overlapping
   *  interaction data yet. */
  async getSimilar(userId: string, limit: number): Promise<CollaborativeResult> {
    const cacheKey = `${CACHE_PREFIX}${userId}:${limit}`;
    return this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS, () => this.compute(userId, limit));
  }

  private async compute(userId: string, limit: number): Promise<CollaborativeResult> {
    const seedWeights = await this.loadSeedInteractions(userId);
    if (seedWeights.size === 0) {
      return { scored: [], basis: "none" };
    }
    const seedIds = [...seedWeights.keys()];

    const neighborIds = await this.findNeighbors(userId, seedIds);
    if (neighborIds.length < MIN_NEIGHBORS) {
      return { scored: [], basis: "none" };
    }

    const { itemWeights, candidateIds } = await this.loadNeighborInteractions(
      neighborIds,
      seedIds,
    );
    if (candidateIds.length === 0) {
      return { scored: [], basis: "none" };
    }

    // Cap the seeds used for similarity to the ones the user engaged with
    // most (a like, or the most-played songs) — beyond a few dozen, extra
    // seeds mostly add compute without changing the ranking.
    const topSeedIds = [...seedWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SEED_ITEMS_FOR_SIMILARITY)
      .map(([id]) => id);

    const seedVectors = topSeedIds.map((id) => this.itemVector(id, neighborIds, itemWeights));
    const candidateVectors = candidateIds.map((id) => ({
      id,
      vector: this.itemVector(id, neighborIds, itemWeights),
    }));

    const scored = candidateVectors
      .map(({ id, vector }) => {
        let score = 0;
        for (let i = 0; i < topSeedIds.length; i++) {
          const sim = cosineSimilarity(seedVectors[i], vector);
          if (sim > 0) score += seedWeights.get(topSeedIds[i])! * sim;
        }
        return { songId: id, score };
      })
      // A zero score means literally no neighbor who liked/played one of
      // the user's seeds also touched this candidate — not a
      // recommendation, just something that slipped into the pool.
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length === 0) {
      return { scored: [], basis: "none" };
    }

    return { scored, basis: "collaborative" };
  }

  // ---------------------------------------------------------------- data

  /** The target user's own implicit-feedback weights, keyed by song id. */
  private async loadSeedInteractions(userId: string): Promise<Map<string, number>> {
    const [likes, history] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, song: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        take: MAX_SEED_LIKES,
        select: { songId: true },
      }),
      this.prisma.listeningHistory.findMany({
        where: { userId, song: { deletedAt: null } },
        orderBy: { playedAt: "desc" },
        take: MAX_SEED_HISTORY,
        select: { songId: true },
      }),
    ]);

    const weights = new Map<string, number>();
    history.forEach(({ songId }) => weights.set(songId, PLAY_WEIGHT));
    // A like always wins over a play for the same song — it's the
    // stronger, more deliberate signal.
    likes.forEach(({ songId }) => weights.set(songId, LIKE_WEIGHT));
    return weights;
  }

  /**
   * Other users who liked/played at least one of the target's seed songs,
   * ranked by total overlap weight and capped to MAX_NEIGHBORS — these are
   * the "people who also liked this" the rest of the pipeline learns from.
   */
  private async findNeighbors(userId: string, seedIds: string[]): Promise<string[]> {
    const [likeRows, historyRows] = await Promise.all([
      this.prisma.like.findMany({
        where: { songId: { in: seedIds }, userId: { not: userId } },
        orderBy: { createdAt: "desc" },
        take: MAX_NEIGHBOR_OVERLAP_ROWS,
        select: { userId: true, songId: true },
      }),
      this.prisma.listeningHistory.findMany({
        where: { songId: { in: seedIds }, userId: { not: userId } },
        orderBy: { playedAt: "desc" },
        take: MAX_NEIGHBOR_OVERLAP_ROWS,
        select: { userId: true, songId: true },
      }),
    ]);

    const overlapWeight = new Map<string, number>();
    const accumulate = (rows: { userId: string; songId: string }[], weight: number) => {
      for (const { userId: neighborId } of rows) {
        overlapWeight.set(neighborId, (overlapWeight.get(neighborId) ?? 0) + weight);
      }
    };
    accumulate(likeRows, LIKE_WEIGHT);
    accumulate(historyRows, PLAY_WEIGHT);

    return [...overlapWeight.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_NEIGHBORS)
      .map(([id]) => id);
  }

  /**
   * Every interaction (on seed *and* candidate songs) from the kept
   * neighbors — this is what lets us build a same-dimension vector for a
   * seed song and a candidate song and compare them with cosine similarity.
   */
  private async loadNeighborInteractions(
    neighborIds: string[],
    seedIds: string[],
  ): Promise<{ itemWeights: Map<string, Map<string, number>>; candidateIds: string[] }> {
    const seedIdSet = new Set(seedIds);

    const [likeRows, historyRows] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId: { in: neighborIds }, song: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        take: MAX_NEIGHBOR_INTERACTION_ROWS,
        select: { userId: true, songId: true },
      }),
      this.prisma.listeningHistory.findMany({
        where: { userId: { in: neighborIds }, song: { deletedAt: null } },
        orderBy: { playedAt: "desc" },
        take: MAX_NEIGHBOR_INTERACTION_ROWS,
        select: { userId: true, songId: true },
      }),
    ]);

    const toRows = (
      rows: { userId: string; songId: string }[],
      weight: number,
    ): InteractionRow[] => rows.map((r) => ({ ...r, weight }));

    const rows = [...toRows(historyRows, PLAY_WEIGHT), ...toRows(likeRows, LIKE_WEIGHT)];

    // neighborId -> (songId -> weight), a like overwriting a play for the
    // same (neighbor, song) pair since it's the stronger signal.
    const itemWeights = new Map<string, Map<string, number>>();
    const candidateCounts = new Map<string, number>();

    for (const { userId: neighborId, songId, weight } of rows) {
      let perUser = itemWeights.get(neighborId);
      if (!perUser) {
        perUser = new Map();
        itemWeights.set(neighborId, perUser);
      }
      perUser.set(songId, Math.max(perUser.get(songId) ?? 0, weight));

      if (!seedIdSet.has(songId)) {
        candidateCounts.set(songId, (candidateCounts.get(songId) ?? 0) + 1);
      }
    }

    // Rank candidates by how many neighbors touched them (a cheap,
    // popularity-among-similar-users proxy) before the full cosine pass,
    // purely to keep the candidate set — and therefore the vector math —
    // bounded on a large catalog.
    const candidateIds = [...candidateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, CANDIDATE_LIMIT)
      .map(([id]) => id);

    return { itemWeights, candidateIds };
  }

  // ------------------------------------------------------------ vectors

  /** A song's vector over the fixed neighbor-user dimension order. */
  private itemVector(
    songId: string,
    neighborIds: string[],
    itemWeights: Map<string, Map<string, number>>,
  ): number[] {
    return neighborIds.map((neighborId) => itemWeights.get(neighborId)?.get(songId) ?? 0);
  }
}
