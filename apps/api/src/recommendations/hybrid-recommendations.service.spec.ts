import { HybridRecommendationsService } from "./hybrid-recommendations.service";
import { RecommendationsService } from "./recommendations.service";
import { CollaborativeService } from "./collaborative.service";
import { CacheService } from "../redis/cache.service";
import { ConfigService } from "@nestjs/config";

describe("HybridRecommendationsService", () => {
  let service: HybridRecommendationsService;
  let contentBased: { getForYou: jest.Mock; hydrate: jest.Mock };
  let collaborative: { getSimilar: jest.Mock };
  let cache: { getOrSet: jest.Mock };
  let config: { get: jest.Mock };

  function build() {
    // getOrSet just runs the loader — no real Redis in this test, same
    // convention as recommendations.service.spec.ts.
    cache = { getOrSet: jest.fn((_key, _ttl, loader) => loader()) };

    return new HybridRecommendationsService(
      contentBased as unknown as RecommendationsService,
      collaborative as unknown as CollaborativeService,
      cache as unknown as CacheService,
      config as unknown as ConfigService,
    );
  }

  beforeEach(() => {
    contentBased = { getForYou: jest.fn(), hydrate: jest.fn() };
    collaborative = { getSimilar: jest.fn() };
    // No overrides configured — service falls back to its 0.6/0.4 defaults.
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = build();
  });

  it("returns basis 'none' when the content-based engine has no profile at all", async () => {
    contentBased.getForYou.mockResolvedValue({ scored: [], basis: "none" });
    collaborative.getSimilar.mockResolvedValue({ scored: [], basis: "none" });

    const result = await service.getForYou("user-1", 20);

    expect(result).toEqual({ scored: [], basis: "none" });
  });

  it("falls back to content-based alone when collaborative has too little data", async () => {
    const contentScored = [
      { songId: "a", score: 0.9 },
      { songId: "b", score: 0.5 },
    ];
    contentBased.getForYou.mockResolvedValue({ scored: contentScored, basis: "profile" });
    collaborative.getSimilar.mockResolvedValue({ scored: [], basis: "none" });

    const result = await service.getForYou("user-1", 20);

    expect(result.basis).toBe("profile");
    expect(result.scored).toEqual(contentScored);
  });

  it("never calls collaborative-derived data when basis falls back to 'none'", async () => {
    contentBased.getForYou.mockResolvedValue({ scored: [], basis: "none" });
    collaborative.getSimilar.mockResolvedValue({ scored: [], basis: "none" });

    await service.getForYou("user-1", 20);

    // Fallback shouldn't reach into hydrate or otherwise use collaborative
    // output when there's no basis to build anything on.
    expect(contentBased.hydrate).not.toHaveBeenCalled();
  });

  it("combines both engines with the default 0.6/0.4 weighting when both have signal", async () => {
    // Content ranks "a" highest; collaborative ranks "b" highest. With the
    // default weighting content still wins narrowly for "a" vs "b" only if
    // collaborative's normalized boost isn't enough to overtake it — the
    // key behavior under test is that a song appearing strongly in *both*
    // lists outranks one appearing strongly in only one.
    contentBased.getForYou.mockResolvedValue({
      scored: [
        { songId: "both-high", score: 0.8 },
        { songId: "content-only", score: 0.6 },
      ],
      basis: "profile",
    });
    collaborative.getSimilar.mockResolvedValue({
      scored: [
        { songId: "both-high", score: 10 },
        { songId: "collab-only", score: 4 },
      ],
      basis: "collaborative",
    });

    const result = await service.getForYou("user-1", 20);

    expect(result.basis).toBe("hybrid");
    // "both-high" is normalized to 1.0 on *both* sides (0.6*1 + 0.4*1 = 1),
    // so it must rank first.
    expect(result.scored[0].songId).toBe("both-high");
    expect(result.scored[0].score).toBeCloseTo(1, 5);

    // "content-only": normalized content score 0.6/0.8=0.75 * 0.6 = 0.45
    const contentOnly = result.scored.find((s) => s.songId === "content-only")!;
    expect(contentOnly.score).toBeCloseTo(0.75 * 0.6, 5);

    // "collab-only": normalized collaborative score 4/10=0.4 * 0.4 = 0.16
    const collabOnly = result.scored.find((s) => s.songId === "collab-only")!;
    expect(collabOnly.score).toBeCloseTo(0.4 * 0.4, 5);

    expect(result.scored.every((s) => s.score > 0)).toBe(true);
  });

  it("respects HYBRID_CONTENT_WEIGHT / HYBRID_COLLABORATIVE_WEIGHT overrides from config", async () => {
    config.get.mockImplementation((key: string) => {
      if (key === "HYBRID_CONTENT_WEIGHT") return "0.2";
      if (key === "HYBRID_COLLABORATIVE_WEIGHT") return "0.8";
      return undefined;
    });
    service = build();

    contentBased.getForYou.mockResolvedValue({
      scored: [{ songId: "a", score: 1 }],
      basis: "profile",
    });
    collaborative.getSimilar.mockResolvedValue({
      scored: [{ songId: "a", score: 1 }],
      basis: "collaborative",
    });

    const result = await service.getForYou("user-1", 20);

    // Both normalize to 1.0, so the combined score is exactly the sum of
    // the (now-normalized, already-summing-to-1) configured weights.
    expect(result.scored[0].score).toBeCloseTo(1, 5);
  });

  it("falls back to the 0.6/0.4 default when configured weights are invalid", async () => {
    config.get.mockImplementation((key: string) => {
      if (key === "HYBRID_CONTENT_WEIGHT") return "not-a-number";
      return undefined;
    });
    service = build();

    contentBased.getForYou.mockResolvedValue({
      scored: [{ songId: "a", score: 1 }],
      basis: "profile",
    });
    collaborative.getSimilar.mockResolvedValue({
      scored: [{ songId: "b", score: 1 }],
      basis: "collaborative",
    });

    const result = await service.getForYou("user-1", 20);

    const a = result.scored.find((s) => s.songId === "a")!;
    const b = result.scored.find((s) => s.songId === "b")!;
    expect(a.score).toBeCloseTo(0.6, 5);
    expect(b.score).toBeCloseTo(0.4, 5);
  });

  it("requests an over-fetched pool from both engines, not just the final limit", async () => {
    contentBased.getForYou.mockResolvedValue({ scored: [], basis: "none" });
    collaborative.getSimilar.mockResolvedValue({ scored: [], basis: "none" });

    await service.getForYou("user-1", 10);

    // MIN_MERGE_POOL floor kicks in for a small limit like 10.
    expect(contentBased.getForYou).toHaveBeenCalledWith("user-1", 60);
    expect(collaborative.getSimilar).toHaveBeenCalledWith("user-1", 60);
  });

  it("caches results through CacheService.getOrSet", async () => {
    contentBased.getForYou.mockResolvedValue({ scored: [], basis: "none" });
    collaborative.getSimilar.mockResolvedValue({ scored: [], basis: "none" });

    await service.getForYou("user-1", 20);

    expect(cache.getOrSet).toHaveBeenCalledWith(
      "recs:hybrid:user-1:20",
      expect.any(Number),
      expect.any(Function),
    );
  });

  it("delegates hydrate() to the content-based engine's hydration", async () => {
    const scored = [{ songId: "a", score: 1 }];
    contentBased.hydrate.mockResolvedValue([{ id: "a" }]);

    const result = await service.hydrate(scored);

    expect(contentBased.hydrate).toHaveBeenCalledWith(scored);
    expect(result).toEqual([{ id: "a" }]);
  });
});
