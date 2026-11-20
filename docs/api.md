# API Reference

Documented incrementally as each phase implements it.

## Health

### `GET /api/health`
Public. Checks API liveness and Postgres connectivity.

## Auth (Phase 2)

All auth endpoints are `@Public()` — they're reachable without an access
token. Every other endpoint in the API requires a valid `Authorization:
Bearer <accessToken>` header by default (global `JwtAuthGuard`).

### `POST /api/auth/register`
Body: `{ email, username, password }` (password ≥ 8 chars).
Creates the user, fires a (stub) verification email, and returns the
same shape as login. Sets the refresh-token cookie.

### `POST /api/auth/login`
Body: `{ email, password }`.
**Response 200**
```json
{ "user": { "id", "email", "username", "role", ... }, "accessToken": "<jwt>" }
```
Also sets `melune_refresh_token` as an httpOnly, `SameSite=Lax` cookie
scoped to `/api/auth`.

### `POST /api/auth/refresh`
No body — reads the refresh cookie. Rotates it (old one is revoked, a new
one issued) and returns a fresh access token. 401 if missing/expired/revoked.

### `POST /api/auth/logout`
Revokes the refresh token tied to the cookie and clears it. `204`.

### `POST /api/auth/forgot-password`
Body: `{ email }`. Always `204`, whether or not the email is registered
(prevents account enumeration). If it exists, a reset token is created
and a (stub) email is logged.

### `POST /api/auth/reset-password`
Body: `{ token, newPassword }`. On success, invalidates every existing
session (all refresh tokens for that user are revoked).

### `POST /api/auth/verify-email`
Body: `{ token }`. Marks the user's email verified.

## Users (Phase 2)

### `GET /api/users/me` — auth required
Returns the current user (no password field).

### `PATCH /api/users/me` — auth required
Body: `{ bio?, avatarUrl? }`.

### `GET /api/users/:id` — public
Public profile lookup.

---
_Endpoints added in later phases: `/playlists`, `/me/library`,
`/me/history`, `/discover/home` (Phase 5), `/search` (Phase 6),
`/analytics/me` (Phase 7), `/recommendations/*` (Phase 9)._

## Catalog (Phase 3)

All `GET` endpoints below are `@Public()`. Mutations require an
`ARTIST` (own resources only) or `ADMIN` (any resource) role.

### Genres
- `GET /api/genres` — list all
- `GET /api/genres/:idOrSlug`
- `POST /api/genres` — ADMIN. Body: `{ name }`
- `PATCH /api/genres/:id` — ADMIN
- `DELETE /api/genres/:id` — ADMIN

### Artists
- `GET /api/artists?page=&limit=` — paginated list
- `GET /api/artists/:idOrSlug` — includes albums + top 10 songs
- `POST /api/artists` — ARTIST. Creates the caller's own profile (one per user). Body: `{ name, bio?, imageUrl? }`
- `PATCH /api/artists/me` — ARTIST. Updates the caller's own profile
- `PATCH /api/artists/:id` — ADMIN. Updates any profile
- `DELETE /api/artists/:id` — ADMIN. Soft delete

### Albums
- `GET /api/albums?artistId=&page=&limit=`
- `GET /api/albums/:idOrSlug` — includes artist + track list
- `POST /api/albums` — ARTIST. Creates an album under the caller's own artist profile. Body: `{ title, coverUrl?, releaseDate? }`
- `PATCH /api/albums/:id` — ARTIST (own) or ADMIN
- `DELETE /api/albums/:id` — ARTIST (own) or ADMIN. Soft delete

### Songs
- `GET /api/songs?artistId=&albumId=&genreId=&page=&limit=`
- `GET /api/songs/:idOrSlug`
- `POST /api/songs` — ARTIST. Body: `{ title, albumId?, genreId?, duration, audioUrl, coverUrl? }`. `albumId`, if given, must belong to the caller's own artist profile (400 otherwise).
- `PATCH /api/songs/:id` — ARTIST (own) or ADMIN
- `DELETE /api/songs/:id` — ARTIST (own) or ADMIN. Soft delete

Song responses also include `hlsPlaylistUrl` (`string | null`) — an
adaptive-bitrate HLS master playlist for the same audio, populated
asynchronously sometime after create/update by a background transcode
job (see "Async Processing — Audio Transcode Queue" in
`docs/architecture.md`). It's not settable through the request body;
`null` just means "not ready yet, or transcoding never ran/failed for
this song" and the web player falls back to `audioUrl` automatically.

Ownership rule (albums + songs): an `ARTIST` can only mutate resources
tied to their own artist profile; an `ADMIN` can mutate any. Enforced
in `ArtistsService.assertOwnership`.

## Library (Phase 5)

Everything below requires auth except where marked `@Public()`.

### Likes
- `POST /api/songs/:songId/like` — `204`. Idempotent.
- `DELETE /api/songs/:songId/like` — `204`. Idempotent.
- `GET /api/me/likes?page=&limit=` — paginated liked songs, newest first.

### Playlists
- `GET /api/playlists?page=&limit=` — `@Public()`. Public playlists only.
- `GET /api/playlists/me?page=&limit=` — the caller's own playlists (public + private).
- `GET /api/playlists/:idOrSlug` — `@Public()`. 404 for a private playlist unless you own it.
- `POST /api/playlists` — Body: `{ title, description?, coverUrl?, isPublic? }` (default `isPublic: true`).
- `PATCH /api/playlists/:id` — owner only.
- `DELETE /api/playlists/:id` — owner only. Soft delete.
- `POST /api/playlists/:id/songs` — owner only. Body: `{ songId }`. 400 if already present.
- `DELETE /api/playlists/:id/songs/:songId` — owner only.
- `PATCH /api/playlists/:id/songs/reorder` — owner only. Body: `{ songIds: string[] }` — the full new ordering; must contain every song currently in the playlist exactly once.

### Library (saved albums/artists/playlists)
- `GET /api/me/library?type=album|artist|playlist&page=&limit=`
- `POST /api/me/library/albums/:id` / `DELETE /api/me/library/albums/:id`
- `POST /api/me/library/artists/:id` / `DELETE /api/me/library/artists/:id`
- `POST /api/me/library/playlists/:id` / `DELETE /api/me/library/playlists/:id`

### History
- `POST /api/me/history/:songId` — `204`. Records a play and increments the song's `playCount` in the same transaction.
- `GET /api/me/history?limit=` — recently played songs, deduped by song, most recent first.

### Discover
- `GET /api/discover/home` — `@Public()`. Anonymous callers get `trending` only (`recentlyPlayed: []`, `madeForYou: null`). Authenticated callers additionally get `recentlyPlayed` (from `ListeningHistory`) and `madeForYou` — the Phase 9 hybrid recommendation mix's top 20 matches (content-based + collaborative, see below), or `null` when there's no likes/history yet to base a mix on.

### Recommendations (Phase 8.2)
- `GET /api/recommendations/for-you?limit=` — auth required (no anonymous version). Content-based cosine-similarity mix over genre + artist + bpm/mood/energy — see `docs/ai.md`. This endpoint stays content-based only; the hybrid content + collaborative mix (`HybridRecommendationsService`) is what powers `madeForYou` in `GET /api/discover/home` above, not this endpoint. Response: `{ items: [{ song, score }], basis: "profile" | "none" }`. `basis: "none"` (empty `items`) when the caller has no likes/history yet.

### Search (Phase 6)
- `GET /api/search?q=&type=all|songs|artists|albums|playlists&page=&limit=` — `@Public()`. The single search endpoint, used by both the Cmd+K palette and the `/search` page.
  - `type=all` (default) ignores `page`/`limit` and returns a fixed 5-per-group preview: `{ query, songs, artists, albums, playlists }`.
  - Any specific `type` returns a normally paginated `{ items, page, limit, total, totalPages }` for that one entity.
  - Ranking combines trigram `similarity()` and full-text `ts_rank()` (see `docs/database.md`), with `playCount` as a tie-breaker only — never enough to outrank a closer text match.
  - Playlists: only `isPublic` ones are returned — a private playlist never surfaces in search, matching `GET /api/playlists`.
  - Rate-limited to 20 requests/10s (`@Throttle` + `ThrottlerGuard` applied on this route only, since every keystroke fires a debounced request and the rest of the API isn't guarded that tightly — see `AppModule`).
- `POST /api/search/history` — Body: `{ query }`. `204`. Records one *committed* search (the frontend calls this on Enter or on picking a result — never per keystroke, or "recent searches" would fill up with fragments of what was still being typed).
- `GET /api/search/history` — the caller's last 8 distinct committed searches, most recent first.
- `DELETE /api/search/history` — `204`. Clears the caller's search history.

Guests don't get server-side history — the web app falls back to a
localStorage list for them (see `lib/recent-searches.ts`), so "recent
searches" still works logged out, just not across devices.

Known limitation: the `Song` shape returned by the catalog endpoints
doesn't carry a per-viewer `isLiked` flag yet, so the web app's like
buttons can't show their true initial state — only `/me/likes` reflects
truth. Adding `isLiked` needs an auth-aware query in `SongsService`,
deferred to keep this pass scoped to the library/history data model.

---
_Endpoints added in later phases: `/discover/mood` (Phase 6.x),
`/analytics/me`, `/analytics/rewind` (Phase 7)._

## Admin (Phase 8.2)

Every route below requires the `ADMIN` role (`@Roles(Role.ADMIN)` at the
controller level). Catalog CRUD (songs/albums/artists/genres) already
lives under `POST/PATCH/DELETE /api/songs`, `/api/albums`, `/api/artists`,
`/api/genres` — an `ADMIN` caller can update or delete *any* row there
(ownership check is bypassed for admins), and can now also **create**
one under an arbitrary artist by passing `artistId` in the body (ignored
for non-admin `ARTIST` callers, who always create under their own
profile). `POST /api/artists` as an admin creates a catalog-only artist
profile with no linked user account. This module covers what the
catalog controllers don't:

- `GET /api/admin/stats` — dashboard totals (`users`, `artists`,
  `songs`, `albums`, `playlists`), `newUsersLast7Days`,
  `playsLast7Days`, `topSongs` (top 5 by `playCount`), and
  `usersByDay` (daily signup counts for the trailing 7 days).
- `GET /api/admin/users?q=&role=&includeBanned=&page=&limit=` — paginated
  user list. `q` matches email/username (case-insensitive substring),
  `role` filters to `USER`/`ARTIST`/`ADMIN`, `includeBanned=true` also
  returns soft-deleted (banned) accounts (excluded by default).
- `PATCH /api/admin/users/:id/role` — Body: `{ role }`. An admin cannot
  change their own role (guardrail against locking themselves out).
- `PATCH /api/admin/users/:id/ban` — soft-deletes the account
  (`deletedAt`) and revokes every active refresh token in the same
  transaction, so a ban actually ends existing sessions. An admin
  cannot ban their own account.
- `PATCH /api/admin/users/:id/unban` — clears `deletedAt`.

### Admin analytics (Phase 11)

A separate controller (`AnalyticsController`/`AnalyticsService`, not
folded into the routes above) covering aggregate reads over listening
data. Same `@Roles(Role.ADMIN)` enforcement. No new `PlayEvent` table —
every endpoint here is a `GROUP BY` over the `ListeningHistory`/`User`/
`Song`/`Genre` rows that already exist. **Not** the same feature as the
user-facing `/analytics/me`/`/analytics/rewind` mentioned above (Phase
7, still not started) — these are admin-only cross-user aggregates, not
a listener's personal history.

- `GET /api/admin/analytics/daily-active-users?rangeDays=` — distinct
  listeners per UTC calendar day, trailing `rangeDays` (default 30,
  max 180). `{ rangeDays, since, series: [{ date, count }] }`.
- `GET /api/admin/analytics/top-genres?rangeDays=` — per-day play
  counts broken down by genre, restricted to the top 5 genres by total
  plays in range; everything else (and untagged songs) collapses into
  a synthetic `"other"` bucket so the chart doesn't grow one series per
  genre in the catalog. `{ rangeDays, since, genres: [{ id, name }],
  series: [{ date, counts: { [genreId]: number } }] }`.
- `GET /api/admin/analytics/retention?weekOffset=` — of the users who
  signed up in the rolling 7-day window `weekOffset` weeks back
  (0 = trailing 7 days ending today), what fraction were seen again
  (via `ListeningHistory`) in the following 7-day window. Returns
  `retentionRate: null` (not `0`) when the cohort itself was empty, and
  `isReturnWeekComplete: false` when that following window hasn't
  fully elapsed yet (always true for `weekOffset=0`) — the rate is
  provisional until then.

