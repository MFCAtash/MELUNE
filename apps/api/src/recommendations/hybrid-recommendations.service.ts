import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RecommendationsService, ScoredSong } from "./recommendations.service";
import { CollaborativeService } from "./collaborative.service";
import { CacheService } from "../redis/cache.service";

/**
 * Phase 9 — combines the two independent "For You" engines:
 *
 *   - RecommendationsService  (content-based: genre/artist/mood/BPM cosine
 *     similarity against the user's own taste profile — untouched by this
 *     file, see recommendations.service.ts)
 *   - CollaborativeService    (item-item collaborative filtering — "people
 *     who liked/played this also liked...", see collaborative.service.ts)
 *
 * into a single weighted ranking, with a hard rule: collaborative
 * filtering is *only* additive. A user with too little interaction/overlap
 * data for collaborative to be meaningful (new account, very niche taste,
 * young catalog) always still gets their content-based mix — this service
 * never turns a working recommendation into no recommendation just because
 * one of the two signals is thin.
 */

export interface HybridResult {
  scored: ScoredSong[];
  /** "hybrid" — both engines contributed a weighted score.
   *  "profile" — content-based only; collaborative didn't have enough
   *  signal yet, so its weight was silently redistributed to content-based
   *  rather than dropped or padded with something unrelated.
   *  "none" — no likes/history at all; there is nothing to base *any* mix
   *  on (matches RecommendationsService's own "none" contract). */
  basis: "hybrid" | "profile" | "none";
}

// Content is weighted higher by default: it's derived from metadata that's
// dense from day one (every song has a genre/artist), while collaborative
// signal only gets reliable once enough *other* users have overlapping
// interactions — so content-based is the safer default majority signal.
const DEFAULT_CONTENT_WEIGHT = 0.6;
const DEFAULT_COLLABORATIVE_WEIGHT = 0.4;

// How much bigger a pool to pull from each engine before merging &
// re-ranking, so the final top-`limit` isn't just whichever engine
// happened to fill its own top slots with the same songs.
const MERGE_POOL_MULTIPLIER = 3;
const MIN_MERGE_POOL = 60;

const CACHE_PREFIX = "recs:hybrid:";
const CACHE_TTL_SECONDS = 300;

@Injectable()
export class HybridRecommendationsService {
  private readonly logger = new Logger(HybridRecommendationsService.name);
  private readonly contentWeight: number;
  private readonly collaborativeWeight: number;

  constructor(
    private readonly contentBased: RecommendationsService,
    private readonly collaborative: CollaborativeService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {
    const { contentWeight, collaborativeWeight } = this.resolveWeights();
    this.contentWeight = contentWeight;
    this.collaborativeWeight = collaborativeWeight;
  }

  /** Top `limit` songs from the hybrid mix — see HybridResult for what
   *  `basis` means for the caller. */
  async getForYou(userId: string, limit: number): Promise<HybridResult> {
    const cacheKey = `${CACHE_PREFIX}${userId}:${limit}`;
    return this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS, () => this.compute(userId, limit));
  }

  /** Hydrates ranked song IDs back into full Song records — delegates to
   *  the content-based engine's hydration, which is source-agnostic (it
   *  just resolves IDs → rows and preserves ranked order). */
  async hydrate(scored: ScoredSong[]) {
    return this.contentBased.hydrate(scored);
  }

  private async compute(userId: string, limit: number): Promise<HybridResult> {
    const pool = Math.max(limit * MERGE_POOL_MULTIPLIER, MIN_MERGE_POOL);

    const [content, collaborative] = await Promise.all([
      this.contentBased.getForYou(userId, pool),
      this.collaborative.getSimilar(userId, pool),
    ]);

    // No likes/history at all — there is no profile of any kind to serve,
    // never backfill with unrelated songs (same contract as both engines).
    if (content.basis === "none") {
      return { scored: [], basis: "none" };
    }

    // Content-based has a profile, but collaborative doesn't have enough
    // overlapping-user signal yet — fall back to content-based alone
    // rather than diluting a real signal with an unreliable one.
    if (collaborative.basis === "none") {
      return { scored: content.scored.slice(0, limit), basis: "profile" };
    }

    const scored = this.combine(content.scored, collaborative.scored).slice(0, limit);

    // Defensive: if every overlapping song somehow nets a zero combined
    // score, don't report "hybrid" for an empty list — fall back instead.
    if (scored.length === 0) {
      return { scored: content.scored.slice(0, limit), basis: "profile" };
    }

    return { scored, basis: "hybrid" };
  }

  /**
   * Weighted merge of the two ranked lists. Each engine's scores are on a
   * different, not-directly-comparable scale (content-based is a bounded
   * [0,1] cosine similarity; collaborative is an unbounded weighted sum),
   * so each list is first max-normalized to [0,1] against its own top
   * score before the configured weights are applied — the same "keep it
   * simple" spirit as both engines' own scoring.
   */
  private combine(contentScored: ScoredSong[], collaborativeScored: ScoredSong[]): ScoredSong[] {
    const contentNorm = normalize(contentScored);
    const collaborativeNorm = normalize(collaborativeScored);

    const combined = new Map<string, number>();
    for (const [songId, score] of contentNorm) {
      combined.set(songId, (combined.get(songId) ?? 0) + score * this.contentWeight);
    }
    for (const [songId, score] of collaborativeNorm) {
      combined.set(songId, (combined.get(songId) ?? 0) + score * this.collaborativeWeight);
    }

    return [...combined.entries()]
      .map(([songId, score]) => ({ songId, score }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /** Reads HYBRID_CONTENT_WEIGHT / HYBRID_COLLABORATIVE_WEIGHT from env
   *  (falling back to the 0.6/0.4 defaults) and re-normalizes them so they
   *  always sum to 1, so a misconfigured .env can't silently shrink or
   *  inflate every score instead of just shifting the mix. */
  private resolveWeights(): { contentWeight: number; collaborativeWeight: number } {
    const rawContent = this.config.get<string>("HYBRID_CONTENT_WEIGHT");
    const rawCollaborative = this.config.get<string>("HYBRID_COLLABORATIVE_WEIGHT");

    let contentWeight = rawContent !== undefined ? Number(rawContent) : DEFAULT_CONTENT_WEIGHT;
    let collaborativeWeight =
      rawCollaborative !== undefined ? Number(rawCollaborative) : DEFAULT_COLLABORATIVE_WEIGHT;

    const isValid =
      Number.isFinite(contentWeight) &&
      Number.isFinite(collaborativeWeight) &&
      contentWeight >= 0 &&
      collaborativeWeight >= 0 &&
      contentWeight + collaborativeWeight > 0;

    if (!isValid) {
      this.logger.warn(
        `Invalid HYBRID_CONTENT_WEIGHT/HYBRID_COLLABORATIVE_WEIGHT — falling back to ${DEFAULT_CONTENT_WEIGHT}/${DEFAULT_COLLABORATIVE_WEIGHT}`,
      );
      contentWeight = DEFAULT_CONTENT_WEIGHT;
      collaborativeWeight = DEFAULT_COLLABORATIVE_WEIGHT;
    }

    const total = contentWeight + collaborativeWeight;
    return { contentWeight: contentWeight / total, collaborativeWeight: collaborativeWeight / total };
  }
}

function normalize(scored: ScoredSong[]): Map<string, number> {
  const max = scored.reduce((m, s) => Math.max(m, s.score), 0);
  const out = new Map<string, number>();
  if (max <= 0) return out;
  for (const s of scored) {
    out.set(s.songId, s.score / max);
  }
  return out;
}
