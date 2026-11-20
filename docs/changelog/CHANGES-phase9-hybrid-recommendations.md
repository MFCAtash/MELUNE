# Phase 9 — Collaborative Filtering on top of the Content-Based Engine

Adds item-item collaborative filtering as a second, independent signal
next to the Phase 8.2 content-based recommender, and a hybrid module
that combines the two with a configurable weight. Per the brief,
`recommendations.service.ts` (the content-based engine) is **untouched**
— everything new lives in parallel modules.

## 1. Collaborative filtering — `collaborative.service.ts`

- Builds an implicit-feedback interaction signal from `Like` (weight 2)
  and `ListeningHistory` (weight 1) — same two tables the content-based
  engine already reads, no schema changes.
- Ranks candidates with a simple **item-item similarity** (people who
  liked/played the user's songs also liked/played...), *not* matrix
  factorization — same simplicity level as the existing cosine-based
  content engine, and reuses its exact `cosineSimilarity` helper from
  `common/utils/vector-math.ts`.
- Every query is row-capped (seed interactions, neighbor discovery,
  neighbor interactions, final candidate pool), so this stays a handful
  of small indexed Postgres queries per request.
- `basis: "collaborative" | "none"` — `"none"` when the user has no
  interactions at all, or fewer than `MIN_NEIGHBORS` (3) other users
  overlap with their taste (new account, young catalog, niche taste).
- `collaborative.service.spec.ts` — unit tests for the no-data case, the
  below-`MIN_NEIGHBORS` case, correct item-item ranking, the
  no-candidates-after-neighbors case, and Redis caching.

## 2. Hybrid combiner — `hybrid-recommendations.service.ts`

- Runs `RecommendationsService.getForYou` (content-based) and
  `CollaborativeService.getSimilar` (collaborative) in parallel over an
  over-fetched pool, so the final top-N isn't just whichever engine
  happened to fill its own top slots.
- Each engine's scores are max-normalized to `[0, 1]` against its own
  top score before combining — the two are not on comparable scales
  (bounded cosine similarity vs. an unbounded weighted sum).
- Weight is configurable via `HYBRID_CONTENT_WEIGHT` /
  `HYBRID_COLLABORATIVE_WEIGHT` in `.env` (default **0.6 / 0.4**),
  re-normalized to always sum to 1; an invalid/missing pair silently
  falls back to the default rather than breaking scoring.
- **Fallback rule**: if collaborative has `basis: "none"` (not enough
  data yet), the result falls back to the content-based mix alone —
  `basis: "profile"` — never diluted or padded. `basis: "none"` only
  when content-based *also* has nothing (no likes/history at all).
  `basis: "hybrid"` once both engines contribute.
- `hydrate()` delegates to the content-based engine's hydration (it's
  source-agnostic — just resolves IDs to rows and preserves order).
- `hybrid-recommendations.service.spec.ts` — unit tests for the
  no-data fallback, the collaborative-insufficient-data fallback,
  correct weighted combination (including a song appearing strongly in
  both lists outranking one appearing in only one), config weight
  overrides, invalid-config fallback to defaults, over-fetch pool
  sizing, and Redis caching.

## 3. Wired into the Home feed

- `DiscoverService.getHome`'s `madeForYou` now calls
  `HybridRecommendationsService` instead of `RecommendationsService`
  directly. Same `HomeFeed` contract as before (`Song[] | null`) — no
  frontend change needed.
- `GET /api/recommendations/for-you` is **intentionally unchanged** —
  it still serves the raw content-based mix only; the hybrid mix is
  Home-feed-only for now (see `docs/ai.md`).

## 4. Config

- `.env.example` — `HYBRID_CONTENT_WEIGHT=0.6`, `HYBRID_COLLABORATIVE_WEIGHT=0.4`.

## Docs

`docs/ai.md` (Phase 9 section rewritten from "not yet implemented" to
shipped), `docs/api.md` (`/discover/home` and `/recommendations/for-you`
entries updated to clarify which engine backs which endpoint).

## Not changed

- `recommendations.service.ts`, `recommendations.service.spec.ts`,
  `recommendations.controller.ts` — per the brief, left exactly as they
  were.
- No schema changes — collaborative filtering reads the same `Like` /
  `ListeningHistory` tables the content-based engine already uses.
