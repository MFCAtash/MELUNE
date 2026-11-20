# Phase 8.2 — Recommendation Engine + Admin Panel

Two independent additions requested together: a lightweight content-based
recommendation engine (the "before PyTorch" step from `docs/ai.md`), and
an admin panel over the RBAC backend that already existed.

## 1. Content-based recommendation engine

Runs entirely inside the existing API — no new service, no new
infrastructure, per the brief ("یک نسخه‌ی سبک content-based... کاملاً با
Postgres موجودتون کار کنه").

**Schema** (`apps/api/prisma/schema.prisma`)
- `Song.bpm Int?`, `Song.mood String?`, `Song.energy Float?` — all
  optional; unset on most songs, the engine degrades to genre + artist.
- Run `npm run prisma:migrate --workspace=apps/api -- --name add_song_content_features`
  to generate the migration (not committed — see `docs/database.md`).

**New module** `apps/api/src/recommendations/`
- `common/utils/vector-math.ts` — cosine similarity + weighted average,
  plain arithmetic, no ML dependency.
- `recommendations.service.ts` — builds a per-user taste vector (genre +
  artist one-hot, mood one-hot, normalized bpm/energy) from likes
  (weight 2) and listening history (recency-decayed), ranks a bounded
  Postgres candidate set by cosine similarity, cached in Redis for 5
  minutes.
- `recommendations.controller.ts` — `GET /api/recommendations/for-you?limit=`.
- `recommendations.service.spec.ts` — unit tests (no-history → `basis:
  "none"`, same-genre/artist ranks above cross-genre, zero-overlap
  candidates excluded, Redis caching wired through `CacheService.getOrSet`).

**Wired into the existing Home feed**
- `DiscoverService.getHome`'s `madeForYou` now calls
  `RecommendationsService` instead of the old "top-3 played genres"
  heuristic — same `HomeFeed` contract (`Song[] | null`), so **no
  frontend change was needed** for this half of the work; `apps/web`'s
  home page already renders whatever `madeForYou` returns.

**Docs**: `docs/ai.md` (rewritten), `docs/api.md`, `docs/database.md`.

## 2. Admin panel

Backend RBAC (`@Roles`, global `JwtAuthGuard` + `RolesGuard`) already
existed — this phase used it rather than building parallel auth.

**Backend** (`apps/api/src/admin/`)
- `GET /api/admin/stats` — totals, 7-day new users/plays, top 5 songs,
  daily signup counts (one `$transaction`, one raw `date_trunc` query
  for the daily bucket — same pattern as `SearchService`'s raw SQL).
- `GET /api/admin/users` — paginated, `q` (email/username substring),
  `role` filter, `includeBanned`.
- `PATCH /api/admin/users/:id/role` — self-demotion blocked.
- `PATCH /api/admin/users/:id/ban` — soft-deletes **and** revokes every
  active refresh token in the same transaction (a ban that left
  sessions valid wouldn't actually stop them).
- `PATCH /api/admin/users/:id/unban`.
- `admin.service.spec.ts` — guardrail unit tests.

**Catalog write gaps closed** — admins could already edit/delete any
song/album/artist (ownership bypassed for `ADMIN`), but couldn't
*create* one under an arbitrary artist. Now:
- `POST /api/songs` / `POST /api/albums` accept `artistId` in the body
  for `ADMIN` callers (ignored for self-serve `ARTIST` callers).
  `artistId` is stripped from `PATCH` — reassigning a song/album to a
  different artist isn't a supported operation, only creation is.
- `POST /api/artists` as `ADMIN` creates a catalog-only artist profile
  with no linked user account (`userId: null`).

**`packages/api-client`**: added `createSong/updateSong/deleteSong`
(+ same for albums/artists/genres, none of which existed before —
only reads did), `getForYou`, and `adminGetStats/adminListUsers/
adminUpdateUserRole/adminBanUser/adminUnbanUser`.

**Frontend** (`apps/web/src/app/admin/`) — new route group, its own
layout/sidebar (guarded by `useRequireAdmin`, redirects non-admins to
`/home`), reachable from the main app via a "پنل مدیریت" link in the
desktop sidebar and the account dropdown (both `role === "ADMIN"`
only):
- `/admin` — dashboard (stat cards, 7-day mini bar chart, top songs).
- `/admin/users` — `@tanstack/react-table` data table: search, role
  filter, inline role `<select>`, ban/unban.
- `/admin/songs`, `/admin/albums` — data tables with create/edit modal
  forms (BPM/mood/energy exposed on the song form) and delete.
- `/admin/catalog` — lighter list-based CRUD for Artists and Genres
  (feeds the artist/genre `<select>`s on the Song/Album forms).
- `components/admin/data-table.tsx` — shared TanStack Table wrapper
  (client-side sort over the current page, server-side pagination).
- `lib/admin-queries.ts` — all the React Query hooks for the above.

**Known simplifications** (flagged rather than silently cut):
- Admin song/album forms take `audioUrl`/`coverUrl` as plain URLs —
  they don't integrate the artist-facing presigned-upload flow (out of
  scope here; wiring `StorageService` presigned URLs into the admin
  forms is a natural follow-up).
- The admin section's UI strings are Persian-only (no i18n toggle),
  unlike the rest of the app.
- No dedicated `admin.controller.spec.ts` / e2e suite — `AdminService`
  has unit coverage for the guardrails (self-ban/self-demote, token
  revocation on ban); the routing/`@Roles` wiring itself follows the
  same pattern already covered by other RBAC-protected controllers.
