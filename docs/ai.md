# AI Service

> This document is design notes / target architecture for Phase 8–9. The
> only thing actually running as a standalone Python service today is
> `services/ai/` — a 🧪 **initial skeleton** (`/health` + a `/recommend`
> proxy to the shipped in-API recommender below, no model). See
> [services/ai/README.md](../services/ai/README.md) for exactly what
> that does and doesn't do.

## Phase 8.2 — content-based recommendations (shipped)

Lives inside the main API (`apps/api/src/recommendations/`), **not** a
separate service — per the original plan below, collaborative filtering
and a standalone Python service are deferred until user/interaction
volume actually justifies the operational cost of a second runtime.
This stage runs entirely on the existing Nest/Postgres/Redis stack:

- **Features**: genre (one-hot), artist (one-hot, capped to the user's
  top ~40 by interaction weight), mood (one-hot, free-form tag), and
  normalized `bpm`/`energy` — see the `Song.bpm` / `Song.mood` /
  `Song.energy` columns in `schema.prisma` (all optional; the engine
  degrades gracefully to genre + artist alone when they're unset).
- **Profile**: a weighted average of the vectors for songs the user has
  liked (weight 2) or played (recency-decayed, most recent ≈1), built
  fresh per request and cached in Redis for 5 minutes
  (`RecommendationsService.getForYou`).
- **Ranking**: cosine similarity between the profile vector and a
  bounded Postgres candidate set (same genre/artist as the profile,
  falling back to globally popular songs to fill out the page) — plain
  arithmetic in `common/utils/vector-math.ts`, no ML library, no
  `pgvector` extension.
- **Endpoint**: `GET /api/recommendations/for-you?limit=` (auth
  required). Also powers `madeForYou` in `GET /api/discover/home`,
  replacing the earlier "top genre, most played" heuristic.
- **Honesty contract carried over from Phase 5**: a user with no
  likes/history gets `basis: "none"` and an empty list — never
  backfilled with unrelated songs pretending to be personalized.

## Phase 9 — collaborative filtering + hybrid ranker (shipped)

Interaction volume still didn't justify standing up the dedicated
Python service sketched below, so — same reasoning as Phase 8.2 —
collaborative filtering shipped as a second, parallel module inside the
existing API instead: `apps/api/src/recommendations/collaborative.service.ts`.
The Phase 8.2 content-based engine (`recommendations.service.ts`) is
completely untouched; the two run side by side and are combined by a
third module, `hybrid-recommendations.service.ts`.

- **Signal**: implicit feedback only — like = 2, play = 1 (flat, no
  recency decay; that nuance already lives in the content-based profile).
- **Method — item-item similarity, not matrix factorization** (same
  "keep it simple" bar as Phase 8.2): build the user's own interaction
  weights ("seeds") → find neighbor users who overlap on at least one
  seed song (bounded, ranked by overlap strength) → pull those
  neighbors' *other* interactions as candidates → build a cosine-based
  item-item similarity between each seed and each candidate over the
  shared neighbor-user dimension, reusing the exact same
  `cosineSimilarity` helper as the content-based engine. Every step is
  row-capped, so this stays a handful of indexed Postgres queries per
  request, not a full matrix factorization job.
- **Fallback contract**: below `MIN_NEIGHBORS` (3) overlapping users, or
  no candidates at all, `CollaborativeService.getSimilar` reports
  `basis: "none"` — same "never backfill with unrelated songs" honesty
  contract as Phase 8.2's `basis: "none"`.
- **Hybrid combination** (`HybridRecommendationsService.getForYou`):
  runs both engines in parallel, max-normalizes each engine's scores to
  `[0, 1]` against its own top score (the two engines' raw scores aren't
  on comparable scales), then combines with a configurable weight —
  `HYBRID_CONTENT_WEIGHT` / `HYBRID_COLLABORATIVE_WEIGHT` in `.env`,
  defaulting to 0.6 / 0.4 and always re-normalized to sum to 1. If
  collaborative filtering doesn't have enough signal yet (new account,
  very niche taste, young catalog), the weight is *not* redistributed
  onto missing data — the result falls back to the content-based mix
  alone (`basis: "profile"`), never a diluted or padded list. `basis:
  "none"` only when there's no likes/history at all to build anything
  on. `basis: "hybrid"` once both signals contribute.
- **Wired into the Home feed**: `DiscoverService.getHome`'s
  `madeForYou` now calls `HybridRecommendationsService` instead of
  `RecommendationsService` directly — same `HomeFeed` contract as
  before (`Song[] | null`), no frontend change needed.
- **`GET /api/recommendations/for-you` is intentionally unchanged** —
  it still serves the raw content-based mix only; the hybrid mix is
  Home-feed-only for now.
- A standalone Python service combining a real collaborative model
  (matrix factorization / embeddings) with the content vectors remains
  the eventual Phase 10 target once volume justifies a second runtime —
  `services/ai/` is still just the health-check + proxy skeleton.
